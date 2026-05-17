import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { validateBody } from '../middlewares/validate.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import * as authController from '../controllers/auth.controller.js';
import {
  createAccountSchema,
  requestOtpSchema,
  verifyOtpSchema,
  refreshBodySchema,
} from '../validators/auth.validator.js';

const router = Router();

const otpRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each email to 3 requests per window (1 hour)
  message: { success: false, message: 'Too many OTP requests from this email, please try again after an hour' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.body.email || ipKeyGenerator(req.ip);
  },
});

router.post('/register', validateBody(createAccountSchema), authController.createAccount);

router.post('/otp/request', otpRateLimiter, validateBody(requestOtpSchema), authController.requestOtp);

router.post('/otp/verify', validateBody(verifyOtpSchema), authController.verifyOtp);

router.post('/refresh', validateBody(refreshBodySchema), authController.refresh);

router.post('/logout', authMiddleware, authController.logout);

router.get('/me', authMiddleware, authController.me);

export default router;
