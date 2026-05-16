import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { normalizeEmail } from '../utils/email.js';

export const ALLOWED_LOGIN_ROLES = ['customer', 'admin'];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Load user for JWT auth — supports ObjectId and string `_id`
 * (needed due to some manual Atlas imports).
 * 
 * @param {string} id - The user ID.
 * @returns {Promise<Object|null>} The user document with refreshTokenVersion, or null.
 */
export async function findUserByIdForAuth(id) {
  if (id == null || id === '') return null;
  const idStr = String(id);

  if (mongoose.Types.ObjectId.isValid(idStr)) {
    const byObjectId = await User.findById(idStr).select('+refreshTokenVersion');
    if (byObjectId) return byObjectId;
  }

  return User.findOne({ _id: idStr }).select('+refreshTokenVersion');
}

/**
 * Finds a user by normalized email.
 * Falls back to case-insensitive match for legacy Atlas rows.
 * 
 * @param {string} email - The email to search for.
 * @returns {Promise<Object|null>} The user document or null.
 */
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

/**
 * Finds a user by email and ensures they exist and have a valid role for login.
 * 
 * @param {string} email - The email to search for.
 * @returns {Promise<Object>} The found user document.
 * @throws {ApiError} If the user is not found or has an unauthorized role.
 */
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

/**
 * Public sign-up: creates a new customer account.
 * Admins are promoted separately.
 * 
 * @param {Object} params - The account creation parameters.
 * @param {string} params.email - The user's email address.
 * @param {string} params.fullName - The user's full name.
 * @returns {Promise<Object>} The newly created user document.
 * @throws {ApiError} If an account with the email already exists.
 */
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
