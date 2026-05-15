import { env } from '../config/env.js';

const ACCESS_MS = 15 * 60 * 1000;
const REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

function baseCookieOptions() {
  const opts = {
    httpOnly: true,
    secure: Boolean(env.COOKIE_SECURE),
    sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
    path: '/',
  };
  if (env.COOKIE_DOMAIN) {
    opts.domain = env.COOKIE_DOMAIN;
  }
  return opts;
}

export function attachAuthCookies(res, { accessToken, refreshToken }) {
  const base = baseCookieOptions();
  res.cookie('access_token', accessToken, { ...base, maxAge: ACCESS_MS });
  res.cookie('refresh_token', refreshToken, { ...base, maxAge: REFRESH_MS });
}

export function clearAuthCookies(res) {
  const base = baseCookieOptions();
  res.clearCookie('access_token', base);
  res.clearCookie('refresh_token', base);
}
