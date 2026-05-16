import mongoose from 'mongoose';
import { LotteryDraw } from '../models/LotteryDraw.js';
import { getDrawWeekBounds } from '../utils/weekBounds.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { Payment } from '../models/Payment.js';

/**
 * Retrieves the currently active lottery draw based on the current date.
 * If no open draw exists for the current week, it creates a new one.
 * 
 * @returns {Promise<Object>} The active lottery draw document.
 */
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

/**
 * Retrieves a specific lottery draw by its ID.
 * 
 * @param {string|mongoose.Types.ObjectId} drawId - The ID of the draw.
 * @returns {Promise<Object>} The lottery draw document.
 * @throws {ApiError} If the draw is not found.
 */
export async function getDrawById(drawId) {
  const draw = await LotteryDraw.findById(drawId);
  if (!draw) throw new ApiError(404, 'Draw not found');
  return draw;
}

/**
 * Recalculates the total revenue for a specific draw based on successful payments.
 * Updates the draw's totalRevenue field in the database.
 * 
 * @param {string|mongoose.Types.ObjectId} drawId - The ID of the draw.
 * @param {mongoose.ClientSession} [session=null] - Optional database session for atomicity.
 * @returns {Promise<number>} The recalculated total revenue.
 */
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
