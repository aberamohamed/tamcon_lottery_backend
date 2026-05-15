import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import * as lotteryController from '../controllers/lottery.controller.js';

const router = Router();

router.get('/current', lotteryController.currentDraw);
router.get('/tickets/mine', authMiddleware, lotteryController.myTickets);

export default router;
