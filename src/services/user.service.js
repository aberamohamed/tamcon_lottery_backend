import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { normalizeEmail } from '../utils/email.js';

export const ALLOWED_LOGIN_ROLES = ['customer', 'admin'];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Fetch a user for JWT authentication. Supports both standard ObjectId and string _id values.
export async function findUserByIdForAuth(id) {
  if (id == null || id === '') return null;
  const idStr = String(id);

  if (mongoose.Types.ObjectId.isValid(idStr)) {
    const byObjectId = await User.findById(idStr).select('+refreshTokenVersion');
    if (byObjectId) return byObjectId;
  }

  return User.findOne({ _id: idStr }).select('+refreshTokenVersion');
}

// Look up a user by their email address. Includes a case-insensitive regex fallback just in case.
export async function findUserByEmail(email) {
  const normalized = normalizeEmail(email);

  let user = await User.findOne({ email: normalized }).select(
    '+refreshTokenVersion email role fullName isVerified walletBalance createdAt',
  );

  if (!user) {
    user = await User.findOne({
      email: { $regex: new RegExp(`^${escapeRegex(normalized)}$`, 'i') },
    }).select('+refreshTokenVersion email role fullName isVerified walletBalance createdAt');
  }

  return user;
}

// Look up a user by email and verify they have a permission level that's allowed to log in.
export async function findUserByEmailOrThrow(email) {
  const user = await findUserByEmail(email);
  if (!user) {
    throw new ApiError(404, 'No account found for this email');
  }
  if (!ALLOWED_LOGIN_ROLES.includes(user.role)) {
    throw new ApiError(403, 'This account is not allowed to sign in');
  }
  return user;
}

/** @deprecated use findUserByEmailOrThrow */
export async function assertRegisteredUserForLogin(email) {
  return findUserByEmailOrThrow(email);
}

// Create a standard customer account (admin upgrades are done manually or via script).
export async function createAccount({ email, fullName }) {
  const normalized = normalizeEmail(email);
  const existing = await findUserByEmail(normalized);
  if (existing) {
    throw new ApiError(409, 'An account with this email already exists');
  }

  try {
    const user = await User.create({
      email: normalized,
      fullName,
      role: 'customer',
      walletBalance: 0,
      isVerified: false,
    });
    return user;
  } catch (err) {
    if (err?.code === 11000) {
      throw new ApiError(409, 'An account with this email already exists');
    }
    throw err;
  }
}
