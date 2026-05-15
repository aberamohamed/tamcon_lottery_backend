import { Router } from 'express';
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

router.post('/register', validateBody(createAccountSchema), authController.createAccount);

router.post('/otp/request', validateBody(requestOtpSchema), authController.requestOtp);

router.post('/otp/verify', validateBody(verifyOtpSchema), authController.verifyOtp);

router.post('/refresh', validateBody(refreshBodySchema), authController.refresh);

router.post('/logout', authMiddleware, authController.logout);

router.get('/me', authMiddleware, authController.me);

export default router;
