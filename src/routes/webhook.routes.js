import { Router } from 'express';
import { chapaWebhook } from '../controllers/webhook.controller.js';

const router = Router();

router.post('/', chapaWebhook);

export default router;
