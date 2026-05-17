import mongoose from 'mongoose';
import { LotteryDraw } from '../models/LotteryDraw.js';
import { getDrawWeekBounds } from '../utils/weekBounds.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { Payment } from '../models/Payment.js';

// Get the currently active lottery draw. If we don't have an active draw for this week yet, spin one up.
export async function getActiveDrawForNow() {
  const now = new Date();
  const { weekStart, weekEnd } = getDrawWeekBounds(now.getTime());
  let draw = await LotteryDraw.findOne({
    status: 'open',
    weekStartDate: { $lte: now },
    weekEndDate: { $gte: now },
  });
  if (!draw) {
    draw = await LotteryDraw.create({
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      status: 'open',
      totalRevenue: 0,
      prizePool: 0,
      winnerCount: 0,
      totalPayout: 0,
      winningNumber: null,
      triggeredBy: null,
      drawDate: null,
    });
  }
  return draw;
}

// Helper to grab a single draw by its ID or throw 404 if it's missing.
export async function getDrawById(drawId) {
  const draw = await LotteryDraw.findById(drawId);
  if (!draw) throw new ApiError(404, 'Draw not found');
  return draw;
}

// Re-sum the successful payments for a draw and update the draw's totalRevenue.
export async function recalculateDrawRevenue(drawId, session = null) {
  const match = { drawId: new mongoose.Types.ObjectId(drawId), status: 'success' };
  let agg = Payment.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
  if (session) {
    agg = agg.session(session);
  }
  const rows = await agg;
  const total = rows[0]?.total || 0;
  await LotteryDraw.findByIdAndUpdate(drawId, { totalRevenue: total }, { session });
  return total;
}
