import { User } from '../models/User.js';
import { Payment } from '../models/Payment.js';
import { Ticket } from '../models/Ticket.js';
import { LotteryDraw } from '../models/LotteryDraw.js';
import { WalletTransaction } from '../models/WalletTransaction.js';
import { DrawWinner } from '../models/DrawWinner.js';
import { env } from '../config/env.js';

// Collect KPI metrics for the admin overview, like user count, open draw sales, and last draw payouts.
export async function getDashboardKpis() {
  const [totalUsers, currentDraw, lastCompletedDraw] = await Promise.all([
    User.countDocuments({ role: 'customer' }),
    LotteryDraw.findOne({ status: 'open' }).sort({ createdAt: -1 }),
    LotteryDraw.findOne({ status: 'completed' }).sort({ drawDate: -1 }),
  ]);

  let currentWeekTicketsSold = 0;
  let currentWeekRevenue = 0;
  let currentPrizePool = 0;
  let packageDistribution = [];

  if (currentDraw) {
    currentWeekTicketsSold = await Ticket.countDocuments({ drawId: currentDraw._id });
    currentWeekRevenue = currentDraw.totalRevenue || 0;
    currentPrizePool = Number((currentWeekRevenue * env.PRIZE_POOL_PERCENT).toFixed(2));

    packageDistribution = await Payment.aggregate([
      { $match: { drawId: currentDraw._id, status: 'success', type: 'ticket' } },
      { $group: { _id: '$quantity', count: { $sum: 1 } } },
      { $project: { package: '$_id', count: 1, _id: 0 } },
      { $sort: { package: 1 } },
    ]);
  }

  const lastDrawWinners = lastCompletedDraw ? lastCompletedDraw.winnerCount : 0;
  const lastDrawPayout = lastCompletedDraw ? lastCompletedDraw.totalPayout : 0;

  // Retrieve past completed draws to generate winnerStats for the frontend line chart
  const pastDraws = await LotteryDraw.find({ status: 'completed' })
    .sort({ drawDate: -1 })
    .limit(6)
    .lean();

  const winnerStats = pastDraws.reverse().map((d, index) => {
    const dateStr = d.drawDate
      ? new Date(d.drawDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : `Draw #${index + 1}`;
    return {
      month: dateStr,
      winners: d.winnerCount || 0,
    };
  });

  return {
    totalUsers,
    currentWeekTicketsSold,
    currentWeekRevenue,
    currentPrizePool,
    lastDrawWinners,
    lastDrawPayout,
    packageDistribution,
    winnerStats,
  };
}

// Generate weekly revenue metrics sorted chronologically for the admin dashboard chart.
export async function revenueByWeekChart(limit = 6) {
  const draws = await LotteryDraw.find({ status: 'completed' })
    .sort({ weekStartDate: -1 })
    .limit(limit)
    .lean();

  // Format precisely to { date: String, amount: Number } to match the frontend Area Chart schema
  return draws.reverse().map((d) => {
    const startStr = d.weekStartDate
      ? new Date(d.weekStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : '';
    const endStr = d.weekEndDate
      ? new Date(d.weekEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : '';
    return {
      date: startStr && endStr ? `${startStr} - ${endStr}` : 'Weekly Draw',
      amount: d.totalRevenue || 0,
    };
  });
}

// Get wallet transactions (deposits/rewards/etc.) with pagination and filtering.
export async function listWalletTransactions({ page, limit, type }) {
  const filter = { status: 'success' };
  if (type) filter.type = type;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    WalletTransaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'email role fullName')
      .lean(),
    WalletTransaction.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

// Get history of all past completed draws.
export async function listDrawHistory({ page, limit }) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    LotteryDraw.find({ status: 'completed' })
      .sort({ drawDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    LotteryDraw.countDocuments({ status: 'completed' }),
  ]);
  return { items, total, page, limit };
}

// Get registered accounts with options to search by name/email or filter by roles.
export async function listUsers({ page, limit, role, search }) {
  const filter = {};
  if (role) filter.role = role;
  if (search) {
    filter.$or = [
      { email: { $regex: search, $options: 'i' } },
      { fullName: { $regex: search, $options: 'i' } },
    ];
  }
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    User.find(filter)
      .select('email fullName role walletBalance isVerified lastLoginAt createdAt updatedAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

// Get open/completed draws for the administration board.
export async function listDrawsAdmin({ page, limit, status }) {
  const filter = status ? { status } : {};
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    LotteryDraw.find(filter)
      .sort({ weekStartDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    LotteryDraw.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}
