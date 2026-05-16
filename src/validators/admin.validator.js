import { z } from 'zod';

export const mongoIdSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i),
});

export const drawHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const transactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  type: z.enum(['win_reward', 'ticket_purchase', 'adjustment']).optional(),
});

export const triggerDrawSchema = z.object({
  drawId: z.string().regex(/^[a-f\d]{24}$/i),
});

export const adminDrawsQuerySchema = z.object({
  status: z.enum(['open', 'completed']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const usersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  role: z.enum(['customer', 'admin']).optional(),
  search: z.string().trim().max(254).optional(),
});
