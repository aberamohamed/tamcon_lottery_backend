import { verifyAccessToken } from '../utils/jwt.js';
import { ApiError } from '../utils/ApiError.js';
import { findUserByIdForAuth } from '../services/user.service.js';

export async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization;
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : null;
    const cookieToken = req.cookies?.access_token;
    const token = bearer || cookieToken;
    if (!token) {
      throw new ApiError(401, 'Authentication required');
    }
    const decoded = verifyAccessToken(token);
    const user = await findUserByIdForAuth(decoded.sub);
    if (!user) {
      throw new ApiError(
        401,
        'Session invalid — sign in again (Verify OTP) and use the new accessToken in Authorization.',
      );
    }
    const tokenRtv = Number(decoded.rtv ?? 0);
    const userRtv = Number(user.refreshTokenVersion ?? 0);
    if (tokenRtv !== userRtv) {
      throw new ApiError(401, 'Session invalidated — verify OTP again');
    }
    req.user = user;
    next();
  } catch (e) {
    if (e.name === 'JsonWebTokenError' || e.name === 'TokenExpiredError') {
      next(new ApiError(401, 'Invalid or expired token'));
    } else {
      next(e);
    }
  }
}
