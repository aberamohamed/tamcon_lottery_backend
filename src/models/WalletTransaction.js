import mongoose from 'mongoose';

const walletTxSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userFullName: { type: String }, // Record user's name at the time of transaction
    type: {
      type: String,
      enum: ['win_reward', 'ticket_purchase', 'adjustment', 'deposit'],
      required: true,
      index: true,
    },
    amount: { type: Number, required: true },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    referenceId: { type: mongoose.Schema.Types.ObjectId, index: true },
    description: { type: String, maxlength: 500 },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed'],
      default: 'success',
      index: true,
    },
  },
  { timestamps: true, collection: 'wallet_transactions' },
);

walletTxSchema.index({ userId: 1, createdAt: -1 });
walletTxSchema.index({ type: 1, createdAt: -1 });
walletTxSchema.index({ referenceId: 1, type: 1 });

export const WalletTransaction = mongoose.model('WalletTransaction', walletTxSchema);
