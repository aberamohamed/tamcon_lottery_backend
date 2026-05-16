import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { OtpVerification } from '../models/OtpVerification.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { generateSixDigitOtp } from '../utils/cryptoRandom.js';
import { sendOtpEmail } from './email.service.js';
import { findUserByEmailOrThrow } from './user.service.js';
import { normalizeEmail } from '../utils/email.js';

const OTP_SALT_ROUNDS = 10;

/**
 * Creates a new OTP for the given email, deletes any existing ones, and dispatches it via email.
 * 
 * @param {string} email - The user's email address.
 * @returns {Promise<Object>} Metadata about the OTP dispatch (expiry, role, full name).
 */
export async function createAndDispatchOtp(email) {
  const normalizedEmail = normalizeEmail(email);
  const user = await findUserByEmailOrThrow(normalizedEmail);

  const otp = generateSixDigitOtp();
  const otpHash = await bcrypt.hash(otp, OTP_SALT_ROUNDS);
  const expiresAt = new Date(Date.now() + env.OTP_EXPIRES_MINUTES * 60 * 1000);

  await OtpVerification.deleteMany({ email: normalizedEmail });

  await OtpVerification.create({
    email: normalizedEmail,
    otpHash,
    expiresAt,
    attempts: 0,
  });

  await sendOtpEmail(normalizedEmail, otp);
  return {
    expiresInMinutes: env.OTP_EXPIRES_MINUTES,
    role: user.role,
    fullName: user.fullName,
  };
}

/**
 * Verifies the provided OTP against the stored hash for the given email.
 * 
 * @param {string} email - The user's email address.
 * @param {string|number} plainOtp - The OTP provided by the user.
 * @returns {Promise<string>} The normalized email if verification succeeds.
 * @throws {ApiError} If the OTP is invalid, expired, or not found.
 */
export async function verifyOtpOrThrow(email, plainOtp) {
  const normalizedEmail = normalizeEmail(email);
  const code = String(plainOtp).trim().padStart(6, '0');

  const record = await OtpVerification.findOne({ email: normalizedEmail }).sort({ createdAt: -1 });
  if (!record) {
    throw new ApiError(400, 'No OTP found for this email. Request a new code first.');
  }
  if (record.expiresAt.getTime() < Date.now()) {
    throw new ApiError(400, 'OTP has expired');
  }

  const ok = await bcrypt.compare(code, record.otpHash);
  if (!ok) {
    record.attempts += 1;
    await record.save();
    throw new ApiError(400, 'Invalid OTP');
  }

  await OtpVerification.deleteMany({ email: normalizedEmail });
  return normalizedEmail;
}

/**
 * Periodically cleans up expired OTP records from the database.
 * 
 * @returns {Promise<void>}
 */
export async function cleanupExpiredOtps() {
  if (mongoose.connection.readyState !== 1) return;
  await OtpVerification.deleteMany({ expiresAt: { $lt: new Date() } });
}
