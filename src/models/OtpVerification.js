import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    /** Never store a plain OTP in production — bcrypt hash only. */
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    purpose: { type: String, default: 'login', enum: ['login'] },
  },
  { timestamps: true, collection: 'otp_verifications' },
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OtpVerification = mongoose.model('OtpVerification', otpSchema);
