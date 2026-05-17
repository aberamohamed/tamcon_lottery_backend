import { asyncHandler } from '../middlewares/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import * as otpService from '../services/otp.service.js';
import * as authService from '../services/auth.service.js';
import * as userService from '../services/user.service.js';
import { attachAuthCookies, clearAuthCookies } from '../utils/cookies.js';
import { toPublicUser } from '../utils/serialize.js';

// Handle new account creation for customers. promotion to admin is separate.
export const createAccount = asyncHandler(async (req, res) => {
  const { email, fullName } = req.body;
  const user = await userService.createAccount({ email, fullName });
  res.status(201).json({
    success: true,
    message: 'Account created. Request an OTP to sign in.',
    data: { user: toPublicUser(user) },
  });
});

// Generate and email/log a login OTP code.
export const requestOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const meta = await otpService.createAndDispatchOtp(email);
  res.json({
    success: true,
    message: 'OTP sent',
    data: meta,
  });
});

// Confirm the OTP code and log the user in, returning tokens (and setting cookies if requested).
export const verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp, useHttpOnlyCookies } = req.body;
  const tokens = await authService.verifyOtpAndIssueTokens(email, otp);
  if (useHttpOnlyCookies) {
    attachAuthCookies(res, tokens);
  }
  res.json({
    success: true,
    data: {
      user: toPublicUser(tokens.user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    },
  });
});

// Refresh user session and issue a new access token using a refresh token.
export const refresh = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refresh_token || req.body?.refreshToken;
  if (!refreshToken) {
    throw new ApiError(401, 'Refresh token missing');
  }
  const tokens = await authService.refreshSession(refreshToken);
  const useCookies = Boolean(req.cookies?.refresh_token);
  if (useCookies) {
    attachAuthCookies(res, tokens);
  }
  res.json({
    success: true,
    data: {
      user: toPublicUser(tokens.user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    },
  });
});

// Log out by clearing auth cookies and invalidating refresh token.
export const logout = asyncHandler(async (req, res) => {
  await authService.logoutUser(req.user._id);
  clearAuthCookies(res);
  res.json({ success: true, message: 'Logged out' });
});

// Return the currently logged-in user profile.
export const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { user: toPublicUser(req.user) } });
});
