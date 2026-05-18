// Helper functions to generate and verify secure JSON Web Tokens (JWT) for user sessions.
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// Sign short-lived Access Tokens (e.g. for route authentication).
export function signAccessToken(payload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  });
}

// Sign long-lived Refresh Tokens (e.g. to keep user logged in across restarts).
export function signRefreshToken(payload) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
}
