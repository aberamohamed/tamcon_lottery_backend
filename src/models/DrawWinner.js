import mongoose from 'mongoose';

const drawWinnerSchema = new mongoose.Schema(
  {
    drawId: { type: mongoose.Schema.Types.ObjectId, ref: 'LotteryDraw', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
    winningAmount: { type: Number, required: true },
  },
  { timestamps: true, collection: 'draw_winners' },
);

drawWinnerSchema.index({ drawId: 1, userId: 1 });
drawWinnerSchema.index({ drawId: 1, ticketId: 1 }, { unique: true });

export const DrawWinner = mongoose.model('DrawWinner', drawWinnerSchema);
