import { verifyOtpOrThrow } from './otp.service.js';
import { findUserByEmailOrThrow, ALLOWED_LOGIN_ROLES } from './user.service.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/User.js';
import { normalizeEmail } from '../utils/email.js';
import { findUserByIdForAuth } from './user.service.js';

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Updates login fields for a user based on their normalized email.
 * This sets the last login time and verifies the email.
 * 
 * @param {string} normalizedEmail - The user's normalized email address.
 * @returns {Promise<Object>} The updated user document.
 * @throws {ApiError} If the account is not found or the role is not allowed to sign in.
 */
async function completeLoginForUser(normalizedEmail) {
  const email = normalizeEmail(normalizedEmail);

  const updated = await User.findOneAndUpdate(
    { email: { $regex: new RegExp(`^${escapeRegex(email)}$`, 'i') } },
    {
      $set: {
        email,
        lastLoginAt: new Date(),
        isVerified: true,
      },
    },
    { new: true, runValidators: true },
  ).select('+refreshTokenVersion email role fullName isVerified walletBalance createdAt');

  if (!updated) {
    throw new ApiError(404, 'No account found for this email');
  }
  if (!ALLOWED_LOGIN_ROLES.includes(updated.role)) {
    throw new ApiError(403, 'This account is not allowed to sign in');
  }
  return updated;
}

/**
 * Verifies a provided OTP for an email and issues access/refresh tokens.
 * 
 * @param {string} email - The user's email address.
 * @param {string} otp - The one-time password provided by the user.
 * @returns {Promise<Object>} An object containing the user data and the signed tokens.
 */
export async function verifyOtpAndIssueTokens(email, otp) {
  const normalizedEmail = await verifyOtpOrThrow(email, otp);
  await findUserByEmailOrThrow(normalizedEmail);
  const loggedIn = await completeLoginForUser(normalizedEmail);
  const payload = {
    sub: String(loggedIn._id),
    rtv: loggedIn.refreshTokenVersion ?? 0,
    role: loggedIn.role,
  };
  return {
    user: loggedIn,
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

/**
 * Refreshes the user's session using a valid refresh token.
 * 
 * @param {string} refreshToken - The refresh token to verify.
 * @returns {Promise<Object>} An object containing the user data and the new signed tokens.
 * @throws {ApiError} If the token is invalid, expired, or the token version does not match.
 */
export async function refreshSession(refreshToken) {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(401, 'Invalid refresh token');
  }
  const user = await findUserByIdForAuth(decoded.sub);
  const tokenRtv = Number(decoded.rtv ?? 0);
  const userRtv = Number(user?.refreshTokenVersion ?? 0);
  if (!user || tokenRtv !== userRtv) {
    throw new ApiError(401, 'Invalid refresh token');
  }
  if (!ALLOWED_LOGIN_ROLES.includes(user.role)) {
    throw new ApiError(403, 'This account is not allowed to sign in');
  }
  const payload = {
    sub: String(user._id),
    rtv: user.refreshTokenVersion ?? 0,
    role: user.role,
  };
  return {
    user,
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

/**
 * Logs out a user by invalidating their current refresh tokens.
 * 
 * @param {string} userId - The ID of the user to log out.
 * @returns {Promise<void>}
 */
export async function logoutUser(userId) {
  await User.findByIdAndUpdate(userId, { $inc: { refreshTokenVersion: 1 } });
}
