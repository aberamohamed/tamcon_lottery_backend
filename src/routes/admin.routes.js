import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { roleMiddleware } from '../middlewares/roleMiddleware.js';
import { validateBody, validateQuery } from '../middlewares/validate.js';
import * as adminController from '../controllers/admin.controller.js';
import {
  drawHistoryQuerySchema,
  transactionsQuerySchema,
  triggerDrawSchema,
  adminDrawsQuerySchema,
  usersQuerySchema,
} from '../validators/admin.validator.js';

const router = Router();

router.use(authMiddleware, roleMiddleware('admin'));

router.get('/kpis', adminController.kpis);
router.get('/users', validateQuery(usersQuerySchema), adminController.users);
router.get('/charts/revenue-weeks', adminController.revenueChart);
router.get('/transactions', validateQuery(transactionsQuerySchema), adminController.transactions);
router.get('/draws/history', validateQuery(drawHistoryQuerySchema), adminController.drawHistory);
router.get('/draws', validateQuery(adminDrawsQuerySchema), adminController.draws);
router.post('/draws/trigger', validateBody(triggerDrawSchema), adminController.triggerDraw);

export default router;
