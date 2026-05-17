import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userFullName: { type: String }, // To explicitly record the user's name for history
    // Keep drawId so we can attribute weekly revenue correctly (needed for ticket purchases, not for plain deposits)
    drawId: { type: mongoose.Schema.Types.ObjectId, ref: 'LotteryDraw', index: true },
    type: {
      type: String,
      enum: ['ticket', 'deposit'],
      default: 'ticket',
      index: true,
    },
    txRef: { type: String, required: true, unique: true, index: true },
    chapaReference: { type: String, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'ETB' },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    paymentMethod: { type: String, default: 'chapa', index: true },
    verifiedAt: { type: Date },
    // Checkout & integration fields for Chapa
    quantity: { type: Number, required: true, min: 1, max: 500, default: 1 },
    checkoutUrl: { type: String },
    idempotencyKey: { type: String, index: true, sparse: true },
    ticketsIssued: { type: Boolean, default: false, index: true },
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true, collection: 'payments' },
);

paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ drawId: 1, status: 1 });
paymentSchema.index({ drawId: 1, createdAt: -1 });

export const Payment = mongoose.model('Payment', paymentSchema);
