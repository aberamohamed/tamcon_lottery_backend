// Zod schemas to sanitize payment parameters and redirect parameters.
import { z } from 'zod';

// Check that the quantity is a positive whole number (users buy at least 1 ticket).
export const createCheckoutSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(100),
});

// Parse transaction references returned in redirect URLs from Chapa.
export const chapaCallbackQuerySchema = z.object({
  trx_ref: z.string().min(1).optional(),
  tx_ref: z.string().min(1).optional(),
});
