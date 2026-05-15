import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { normalizeEmail } from '../utils/email.js';

export const ALLOWED_LOGIN_ROLES = ['customer', 'admin'];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Finds user by normalized email; falls back to case-insensitive match for legacy Atlas rows. */
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

/** Public sign-up: creates a customer account (admins are promoted separately). */
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
