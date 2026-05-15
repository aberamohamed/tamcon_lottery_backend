import mongoose from 'mongoose';
import { LotteryDraw } from '../models/LotteryDraw.js';
import { Ticket } from '../models/Ticket.js';
import { User } from '../models/User.js';
import { WalletTransaction } from '../models/WalletTransaction.js';
import { DrawWinner } from '../models/DrawWinner.js';
import { Notification } from '../models/Notification.js';
import { AdminLog } from '../models/AdminLog.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { generateWinningNumber } from '../utils/cryptoRandom.js';
import { recalculateDrawRevenue } from './lottery.service.js';

export async function executeWeeklyDraw({ drawId, admin, ip }) {
  const session = await mongoose.startSession();
  try {
    let summary;
    await session.withTransaction(async () => {
      const draw = await LotteryDraw.findById(drawId).session(session);
      if (!draw) {
        throw new ApiError(404, 'Draw not found');
      }
      if (draw.status === 'completed') {
        throw new ApiError(400, 'Draw already completed');
      }
      if (draw.status !== 'open') {
        throw new ApiError(400, 'Draw must be open to run');
      }

      const revenue = await recalculateDrawRevenue(draw._id, session);
      const prizePool = Math.floor(revenue * env.PRIZE_POOL_PERCENT);

      const winningNumber = generateWinningNumber();

      const winners = await Ticket.find({ drawId: draw._id, ticketNumber: winningNumber })
        .session(session)
        .select('_id userId ticketNumber');

      await Ticket.updateMany({ drawId: draw._id }, { $set: { status: 'lost' } }, { session });
      if (winners.length > 0) {
        await Ticket.updateMany(
          { drawId: draw._id, ticketNumber: winningNumber },
          { $set: { status: 'won' } },
          { session },
        );
      }

      let totalPayout = 0;

      if (winners.length > 0 && prizePool > 0) {
        const baseShare = Math.floor(prizePool / winners.length);
        let remainder = prizePool - baseShare * winners.length;

        for (const w of winners) {
          let share = baseShare;
          if (remainder > 0) {
            share += 1;
            remainder -= 1;
          }
          totalPayout += share;

          const user = await User.findById(w.userId).session(session);
          if (!user) continue;
          const balanceBefore = user.walletBalance;
          const balanceAfter = balanceBefore + share;
          user.walletBalance = balanceAfter;
          await user.save({ session });

          await WalletTransaction.create(
            [
              {
                userId: w.userId,
                type: 'win_reward',
                amount: share,
                balanceBefore,
                balanceAfter,
                referenceId: draw._id,
                description: `Weekly lottery winning reward (${winningNumber})`,
              },
            ],
            { session },
          );

          await DrawWinner.create(
            [
              {
                drawId: draw._id,
                userId: w.userId,
                ticketId: w._id,
                winningAmount: share,
              },
            ],
            { session },
          );

          await Notification.create(
            [
              {
                userId: w.userId,
                title: 'Congratulations!',
                message: `You won ${share.toLocaleString('en-US')} ETB in this week's draw.`,
                type: 'win',
                isRead: false,
              },
            ],
            { session },
          );
        }
      }

      draw.totalRevenue = revenue;
      draw.prizePool = prizePool;
      draw.winningNumber = winningNumber;
      draw.winnerCount = winners.length;
      draw.totalPayout = totalPayout;
      draw.status = 'completed';
      draw.triggeredBy = admin._id;
      draw.drawDate = new Date();
      await draw.save({ session });

      await AdminLog.create(
        [
          {
            adminId: admin._id,
            action: 'TRIGGER_DRAW',
            metadata: {
              drawId: String(draw._id),
              winningNumber,
              totalRevenue: revenue,
              prizePool,
              winnerCount: winners.length,
              totalPayout,
              ip,
            },
          },
        ],
        { session },
      );

      summary = {
        drawId: draw._id,
        winningNumber,
        totalRevenue: revenue,
        prizePool,
        winnerCount: winners.length,
        totalPayout,
      };
    });
    return summary;
  } finally {
    await session.endSession();
  }
}
