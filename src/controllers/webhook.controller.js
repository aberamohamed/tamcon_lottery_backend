import { asyncHandler } from '../middlewares/asyncHandler.js';
import { verifyChapaSignature } from '../utils/chapaWebhook.js';
import { fulfillPaymentFromChapa } from '../services/payment.service.js';
import { ApiError } from '../utils/ApiError.js';
import { chapaConfig } from '../config/chapa.js';
import { env } from '../config/env.js';

function extractTxRef(event) {
  return event?.tx_ref || event?.trx_ref || event?.data?.tx_ref || event?.meta?.tx_ref;
}

function isChargeSuccess(event) {
  const ev = (event?.event || '').toLowerCase();
  const status = (event?.status || '').toLowerCase();
  return ev === 'charge.success' || status === 'success';
}

// Secure webhook handler for Chapa. Checks signature and triggers fulfillment upon success.
export const chapaWebhook = asyncHandler(async (req, res) => {
  const raw =
    req.body instanceof Buffer ? req.body.toString('utf8') : typeof req.body === 'string' ? req.body : '';

  if (!chapaConfig.webhookSecret) {
    if (env.NODE_ENV === 'production') {
      return res.status(500).send('webhook secret not configured');
    }
    // eslint-disable-next-line no-console
    console.warn('Chapa, CHAPA_WEBHOOK_SECRET not set — skipping signature check (development only)');
  } else if (!verifyChapaSignature(raw, req.headers, chapaConfig.webhookSecret)) {
    let parsed;
    try {
      parsed = JSON.parse(raw || '{}');
    } catch {
      parsed = null;
    }
    const fallback = parsed ? JSON.stringify(parsed) : '';
    if (!fallback || !verifyChapaSignature(fallback, req.headers, chapaConfig.webhookSecret)) {
      return res.status(401).send('invalid signature');
    }
  }

  let event;
  try {
    event = JSON.parse(raw || '{}');
  } catch {
    return res.status(400).send('invalid json');
  }

  const txRef = extractTxRef(event);
  if (!txRef) {
    return res.status(400).send('missing tx_ref');
  }

  if (!isChargeSuccess(event)) {
    return res.status(200).json({ received: true });
  }

  try {
    await fulfillPaymentFromChapa(txRef);
    return res.status(200).json({ received: true });
  } catch (e) {
    if (e instanceof ApiError && e.statusCode >= 400 && e.statusCode < 500) {
      return res.status(200).json({ received: true, warning: e.message });
    }
    throw e;
  }
});
