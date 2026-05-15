import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 160 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    role: {
      type: String,
      enum: ['customer', 'admin'],
      default: 'customer',
      index: true,
    },
    walletBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    refreshTokenVersion: {
      type: Number,
      default: 0,
      select: false,
    },
    lastLoginAt: { type: Date },
  },
  { timestamps: true, collection: 'users' },
);

userSchema.index({ createdAt: 1 });
userSchema.index({ role: 1, createdAt: -1 });

userSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.refreshTokenVersion;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);
