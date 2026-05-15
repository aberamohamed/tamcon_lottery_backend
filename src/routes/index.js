import { Router } from 'express';
import authRoutes from './auth.routes.js';
import lotteryRoutes from './lottery.routes.js';
import paymentRoutes from './payment.routes.js';
import adminRoutes from './admin.routes.js';

export const router = Router();

router.use('/auth', authRoutes);
router.use('/lottery', lotteryRoutes);
router.use('/payments', paymentRoutes);
router.use('/admin', adminRoutes);
