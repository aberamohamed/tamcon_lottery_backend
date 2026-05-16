import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { validateBody } from '../middlewares/validate.js';
import * as paymentController from '../controllers/payment.controller.js';
import { createCheckoutSchema } from '../validators/payment.validator.js';

const router = Router();

router.get('/chapa/config', paymentController.chapaConfigPublic);

router.post(
  '/checkout',
  authMiddleware,
  validateBody(createCheckoutSchema),
  paymentController.createCheckout,
);

router.get('/chapa/callback', paymentController.chapaCallback);
router.post('/chapa/callback', paymentController.chapaCallback);
router.post('/chapa/webhook', paymentController.chapaWebhook);
router.get('/verify/:txRef', paymentController.verifyPayment);

export default router;
