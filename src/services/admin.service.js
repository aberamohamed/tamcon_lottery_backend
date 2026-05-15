import { User } from '../models/User.js';
import { Payment } from '../models/Payment.js';
import { Ticket } from '../models/Ticket.js';
import { LotteryDraw } from '../models/LotteryDraw.js';
import { WalletTransaction } from '../models/WalletTransaction.js';
import { DrawWinner } from '../models/DrawWinner.js';

export async function getDashboardKpis() {
  const [totalUsers, revenueAgg, ticketsSold, prizePoolAgg, winnersCount, drawsCompleted] =
    await Promise.all([
      User.countDocuments(),
      Payment.aggregate([
        { $match: { status: 'success' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Ticket.countDocuments(),
      LotteryDraw.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$prizePool' } } },
      ]),
      DrawWinner.countDocuments(),
      LotteryDraw.countDocuments({ status: 'completed' }),
    ]);

  const totalRevenue = revenueAgg[0]?.total || 0;
  const totalPrizePoolFromDraws = prizePoolAgg[0]?.total || 0;

  return {
    totalUsers,
    totalRevenue,
    ticketsSold,
    totalPrizePoolFromDraws,
    winnersCount,
    completedDraws: drawsCompleted,
  };
}

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
