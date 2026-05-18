import mongoose from 'mongoose';
import { LotteryDraw } from '../models/LotteryDraw.js';
import { Ticket } from '../models/Ticket.js';
import { User } from '../models/User.js';
import { WalletTransaction } from '../models/WalletTransaction.js';
import { DrawWinner } from '../models/DrawWinner.js';
import { AdminLog } from '../models/AdminLog.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { generateWinningNumber } from '../utils/cryptoRandom.js';
import { recalculateDrawRevenue } from './lottery.service.js';
import { sendWinnerEmail } from './email.service.js';

// Run the weekly draw: calculate the prize pool, generate a winning number, credit the winners, and close the draw.
// All of this runs inside a database transaction so that we never get partial payouts if the server crashes.
export async function executeWeeklyDraw({ drawId, admin, ip }) {
  const session = await mongoose.startSession();
  const emailsToSend = [];
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

      const ticketCount = await Ticket.countDocuments({ drawId: draw._id }).session(session);
      if (ticketCount < 2) {
        throw new ApiError(400, 'Cannot trigger draw. A minimum of 2 purchased tickets is required to run the draw.');
      }

      const revenue = await recalculateDrawRevenue(draw._id, session);
      const prizePool = Number((revenue * env.PRIZE_POOL_PERCENT).toFixed(2));

      // Select a winning number randomly from the pool of actually purchased tickets for this draw
      const tickets = await Ticket.find({ drawId: draw._id }).session(session).select('ticketNumber');
      const randomIndex = Math.floor(Math.random() * tickets.length);
      const winningNumber = tickets[randomIndex].ticketNumber;

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
        // Precise division using cents to guarantee exact splits and avoid floating point inaccuracies
        const prizePoolCents = Math.round(prizePool * 100);
        const baseShareCents = Math.floor(prizePoolCents / winners.length);
        let remainderCents = prizePoolCents - baseShareCents * winners.length;

        for (const w of winners) {
          let shareCents = baseShareCents;
          if (remainderCents > 0) {
            shareCents += 1;
            remainderCents -= 1;
          }
          const share = Number((shareCents / 100).toFixed(2));
          totalPayout = Number((totalPayout + share).toFixed(2));

          const user = await User.findById(w.userId).session(session);
          if (!user) continue;
          const balanceBefore = user.walletBalance || 0;
          const balanceAfter = Number((balanceBefore + share).toFixed(2));
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

          emailsToSend.push({ email: user.email, amount: share });
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

    // Send emails outside the transaction to prevent locking
    for (const { email, amount } of emailsToSend) {
      sendWinnerEmail(email, amount).catch(err => {
        console.error(`Failed to send winner email to ${email}:`, err);
      });
    }

    return summary;
  } finally {
    await session.endSession();
  }
}
