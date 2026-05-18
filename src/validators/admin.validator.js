// Zod validation schemas to sanitize and double-check incoming admin query parameters and payloads.
import { z } from 'zod';

// Validate that the request param contains a valid 24-character hexadecimal MongoDB ObjectId.
export const mongoIdSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i),
});

// Sanitize page and limit values for draw history lookups.
export const drawHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Sanitize filter variables for admin transaction log tables.
export const transactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  type: z.enum(['win_reward', 'ticket_purchase', 'adjustment']).optional(),
});

// Validate that the body payload contains a valid draw ID before manually triggering a drawing.
export const triggerDrawSchema = z.object({
  drawId: z.string().regex(/^[a-f\d]{24}$/i),
});

// Validate queries for filtering draws (e.g. searching only open or completed draws).
export const adminDrawsQuerySchema = z.object({
  status: z.enum(['open', 'completed']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// Sanitize user table filters, search strings, and pagination limits.
export const usersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  role: z.enum(['customer', 'admin']).optional(),
  search: z.string().trim().max(254).optional(),
});
