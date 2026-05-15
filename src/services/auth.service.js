import { verifyOtpOrThrow } from './otp.service.js';
import { findUserByEmailOrThrow, ALLOWED_LOGIN_ROLES } from './user.service.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/User.js';
import { normalizeEmail } from '../utils/email.js';

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Update login fields by email (avoids save() failures on legacy/manual Atlas _id shapes). */
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

export async function verifyOtpAndIssueTokens(email, otp) {
  const normalizedEmail = await verifyOtpOrThrow(email, otp);
  await findUserByEmailOrThrow(normalizedEmail);
  const loggedIn = await completeLoginForUser(normalizedEmail);
  const payload = {
    sub: String(loggedIn._id),
    rtv: loggedIn.refreshTokenVersion,
    role: loggedIn.role,
  };
  return {
    user: loggedIn,
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

export async function refreshSession(refreshToken) {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(401, 'Invalid refresh token');
  }
  const user = await User.findById(decoded.sub).select('+refreshTokenVersion');
  if (!user || user.refreshTokenVersion !== decoded.rtv) {
    throw new ApiError(401, 'Invalid refresh token');
  }
  if (!ALLOWED_LOGIN_ROLES.includes(user.role)) {
    throw new ApiError(403, 'This account is not allowed to sign in');
  }
  const payload = { sub: String(user._id), rtv: user.refreshTokenVersion, role: user.role };
  return {
    user,
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

export async function logoutUser(userId) {
  await User.findByIdAndUpdate(userId, { $inc: { refreshTokenVersion: 1 } });
}
