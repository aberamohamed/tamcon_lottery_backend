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
    User.countDocuments(),
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
    currentPrizePool = Math.floor(currentWeekRevenue * env.PRIZE_POOL_PERCENT);

    packageDistribution = await Payment.aggregate([
      { $match: { drawId: currentDraw._id, status: 'success', type: 'ticket' } },
      { $group: { _id: '$quantity', count: { $sum: 1 } } },
      { $project: { package: '$_id', count: 1, _id: 0 } },
      { $sort: { package: 1 } },
    ]);
  }

  const lastDrawWinners = lastCompletedDraw ? lastCompletedDraw.winnerCount : 0;
  const lastDrawPayout = lastCompletedDraw ? lastCompletedDraw.totalPayout : 0;

  return {
    totalUsers,
    currentWeekTicketsSold,
    currentWeekRevenue,
    currentPrizePool,
    lastDrawWinners,
    lastDrawPayout,
    packageDistribution,
  };
}

// Generate weekly revenue metrics sorted chronologically for the admin dashboard chart.
export async function revenueByWeekChart(limit = 12) {
  return LotteryDraw.aggregate([
    { $match: { status: 'completed' } },
    { $sort: { weekStartDate: -1 } },
    { $limit: limit },
    {
      $project: {
        _id: 0,
        weekStartDate: 1,
        weekEndDate: 1,
        totalRevenue: 1,
        prizePool: 1,
        winnerCount: 1,
        totalPayout: 1,
      },
    },
    { $sort: { weekStartDate: 1 } },
  ]);
}

// Get wallet transactions (deposits/rewards/etc.) with pagination and filtering.
export async function listWalletTransactions({ page, limit, type }) {
  const filter = type ? { type } : {};
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
