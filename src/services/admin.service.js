import { User } from '../models/User.js';
import { Payment } from '../models/Payment.js';
import { Ticket } from '../models/Ticket.js';
import { LotteryDraw } from '../models/LotteryDraw.js';
import { WalletTransaction } from '../models/WalletTransaction.js';
import { DrawWinner } from '../models/DrawWinner.js';
import { env } from '../config/env.js';

/**
 * Retrieves key performance indicators for the admin dashboard.
 * Focuses on real-time metrics for the current week and last completed draw.
 * 
 * @returns {Promise<Object>} An object containing the KPI metrics.
 */
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

/**
 * Generates data for the revenue-by-week chart on the admin dashboard.
 * 
 * @param {number} [limit=12] - The maximum number of past weeks to retrieve.
 * @returns {Promise<Array>} An array of aggregated draw data sorted chronologically.
 */
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

/**
 * Lists paginated wallet transactions, optionally filtered by type.
 * 
 * @param {Object} params - The pagination and filtering parameters.
 * @param {number} params.page - The current page number.
 * @param {number} params.limit - The number of items per page.
 * @param {string} [params.type] - The type of transaction to filter by.
 * @returns {Promise<Object>} A paginated list of wallet transactions.
 */
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

/**
 * Lists the paginated history of completed lottery draws.
 * 
 * @param {Object} params - The pagination parameters.
 * @param {number} params.page - The current page number.
 * @param {number} params.limit - The number of items per page.
 * @returns {Promise<Object>} A paginated list of completed draws.
 */
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

/**
 * Lists paginated users, optionally filtered by role or search term.
 * 
 * @param {Object} params - The pagination and filtering parameters.
 * @param {number} params.page - The current page number.
 * @param {number} params.limit - The number of items per page.
 * @param {string} [params.role] - The user role to filter by.
 * @param {string} [params.search] - A search term matching email or full name.
 * @returns {Promise<Object>} A paginated list of users.
 */
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

/**
 * Lists paginated draws for the admin interface, optionally filtered by status.
 * 
 * @param {Object} params - The pagination and filtering parameters.
 * @param {number} params.page - The current page number.
 * @param {number} params.limit - The number of items per page.
 * @param {string} [params.status] - The status to filter by.
 * @returns {Promise<Object>} A paginated list of lottery draws.
 */
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
