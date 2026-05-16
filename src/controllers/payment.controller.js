import { asyncHandler } from '../middlewares/asyncHandler.js';
import * as paymentService from '../services/payment.service.js';
import { env } from '../config/env.js';
import { chapaConfig } from '../config/chapa.js';

/**
 * Exposes the public Chapa configuration to the frontend client.
 */
export const chapaConfigPublic = asyncHandler(async (_req, res) => {
  res.json({
    success: true,
    data: {
      publicKey: chapaConfig.publicKey,
      mode: chapaConfig.secretKey.includes('TEST') ? 'test' : 'live',
    },
  });
});

/**
 * Initializes a new checkout session for purchasing tickets.
 */
export const createCheckout = asyncHandler(async (req, res) => {
  const { quantity } = req.body;
  const session = await paymentService.createCheckoutSession({ user: req.user, quantity });
  res.status(201).json({ success: true, data: session });
});

/**
 * Handles the redirect callback from Chapa after a payment attempt.
 */
export const chapaCallback = asyncHandler(async (req, res) => {
  console.log('--- [Chapa Callback DEBUG] START ---');
  console.log('Method:', req.method);
  console.log('URL:', req.originalUrl);
  console.log('Query:', JSON.stringify(req.query, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('--- [Chapa Callback DEBUG] END ---');
  
  const txRef = req.query.tx_ref || req.query.trx_ref || req.body.tx_ref || req.body.trx_ref;
  
  if (!txRef) {
    console.error('[Chapa Callback] Missing transaction reference in both query and body');
    return res.redirect(`${env.FRONTEND_URL}/dashboard/tickets/receipt?status=missing_ref`);
  }
  
  // We don't necessarily need to fulfill here if the frontend or webhook does it,
  // but it's safer to trigger it to ensure the user sees the latest state.
  try {
    await paymentService.fulfillPaymentFromChapa(txRef);
    
    // Always redirect back to tickets dashboard to show status and balance
    return res.redirect(`${env.FRONTEND_URL}/dashboard/tickets?status=success&trx_ref=${encodeURIComponent(txRef)}`);
  } catch (error) {
    const isAlreadyProcessed = error.message?.includes('alreadyProcessed') || error.message?.includes('processed');
    const status = isAlreadyProcessed ? 'success' : 'failed';
    
    return res.redirect(`${env.FRONTEND_URL}/dashboard/tickets?status=${status}&trx_ref=${encodeURIComponent(txRef)}${isAlreadyProcessed ? '' : `&error=${encodeURIComponent(error.message)}`}`);
  }
});

/**
 * API endpoint to manually verify a payment status.
 */
export const verifyPayment = asyncHandler(async (req, res) => {
  const txRef = req.params.txRef || req.query.tx_ref || req.query.trx_ref;
  if (!txRef) {
    return res.status(400).json({ success: false, message: 'Missing transaction reference' });
  }

  try {
    const data = await paymentService.fulfillPaymentFromChapa(txRef);
    return res.json({
      success: true,
      message: data.alreadyProcessed ? 'Payment already verified' : 'Payment verified successfully',
      data,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Verification failed',
      trx_ref: txRef,
    });
  }
});

/**
 * Webhook handler for asynchronous payment events from Chapa.
 */
export const chapaWebhook = asyncHandler(async (req, res) => {
  // Chapa sends webhook as POST with a signature header
  // Note: For 'real payment process', you should verify the signature here
  // const signature = req.headers['x-chapa-signature'];
  
  const { tx_ref, status } = req.body;
  if (!tx_ref) {
    return res.status(400).json({ success: false, message: 'No reference in webhook' });
  }

  if (status === 'success') {
    try {
      await paymentService.fulfillPaymentFromChapa(tx_ref);
    } catch (error) {
      // Log error but return 200 to Chapa to avoid retries if it's already processed
      console.error('Webhook fulfillment error:', error.message);
    }
  }

  // Always return 200 to Chapa for webhooks
  res.status(200).json({ success: true });
});
