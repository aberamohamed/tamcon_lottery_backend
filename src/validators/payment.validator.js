import { z } from 'zod';

export const createCheckoutSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(100),
});

export const chapaCallbackQuerySchema = z.object({
  trx_ref: z.string().min(1).optional(),
  tx_ref: z.string().min(1).optional(),
});
