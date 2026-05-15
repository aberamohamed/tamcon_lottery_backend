import mongoose from 'mongoose';

const drawSchema = new mongoose.Schema(
  {
    weekStartDate: { type: Date, required: true, index: true },
    weekEndDate: { type: Date, required: true, index: true },
    winningNumber: { type: String, default: null, index: true },
    totalRevenue: { type: Number, default: 0 },
    prizePool: { type: Number, default: 0 },
    winnerCount: { type: Number, default: 0 },
    totalPayout: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['open', 'completed'],
      default: 'open',
      index: true,
    },
    triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    drawDate: { type: Date, default: null },
  },
  { timestamps: true, collection: 'lottery_draws' },
);

drawSchema.index({ status: 1, weekEndDate: -1 });
drawSchema.index({ createdAt: -1 });

export const LotteryDraw = mongoose.model('LotteryDraw', drawSchema);
