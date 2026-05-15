import mongoose from 'mongoose';

const ticketSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    drawId: { type: mongoose.Schema.Types.ObjectId, ref: 'LotteryDraw', required: true, index: true },
    ticketNumber: { type: String, required: true },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: true, index: true },
    ticketPrice: { type: Number, required: true },
    purchaseDate: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['active', 'won', 'lost'],
      default: 'active',
      index: true,
    },
  },
  { timestamps: true, collection: 'tickets' },
);

ticketSchema.index({ drawId: 1, ticketNumber: 1 }, { unique: true });
ticketSchema.index({ userId: 1, createdAt: -1 });
ticketSchema.index({ drawId: 1, userId: 1 });

export const Ticket = mongoose.model('Ticket', ticketSchema);
