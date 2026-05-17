import { asyncHandler } from '../middlewares/asyncHandler.js';
import { Ticket } from '../models/Ticket.js';
import { getActiveDrawForNow } from '../services/lottery.service.js';
import { env } from '../config/env.js';

// Fetch data for the current open lottery draw (price, pool percentage, dates).
export const currentDraw = asyncHandler(async (req, res) => {
  const draw = await getActiveDrawForNow();
  res.json({
    success: true,
    data: {
      draw,
      ticketPrice: env.TICKET_PRICE_ETB,
      prizePoolPercent: env.PRIZE_POOL_PERCENT,
    },
  });
});

// Get a paginated list of tickets owned by the logged-in user.
export const myTickets = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;
  const filter = { userId: req.user._id };
  const [items, total] = await Promise.all([
    Ticket.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('drawId', 'weekStartDate weekEndDate status winningNumber prizePool')
      .lean(),
    Ticket.countDocuments(filter),
  ]);
  res.json({ success: true, data: { items, total, page, limit } });
});
