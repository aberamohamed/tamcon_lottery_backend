import { asyncHandler } from '../middlewares/asyncHandler.js';
import * as paymentService from '../services/payment.service.js';
import { env } from '../config/env.js';
import { chapaConfig } from '../config/chapa.js';

export const chapaConfigPublic = asyncHandler(async (_req, res) => {
  res.json({
    success: true,
    data: {
      publicKey: chapaConfig.publicKey,
      mode: chapaConfig.secretKey.includes('TEST') ? 'test' : 'live',
    },
  });
});

export const createCheckout = asyncHandler(async (req, res) => {
  const { quantity } = req.body;
  const session = await paymentService.createCheckoutSession({ user: req.user, quantity });
  res.status(201).json({ success: true, data: session });
});

export const chapaCallback = asyncHandler(async (req, res) => {
  const txRef = req.query.tx_ref || req.query.trx_ref;
  if (!txRef) {
    return res.redirect(`${env.FRONTEND_URL}?payment=missing_ref`);
  }
  try {
    await paymentService.fulfillPaymentFromChapa(txRef);
    return res.redirect(`${env.FRONTEND_URL}?payment=success&tx_ref=${encodeURIComponent(txRef)}`);
  } catch {
    return res.redirect(`${env.FRONTEND_URL}?payment=error&tx_ref=${encodeURIComponent(txRef)}`);
  }
});
