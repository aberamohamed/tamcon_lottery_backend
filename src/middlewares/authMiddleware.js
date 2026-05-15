import { verifyAccessToken } from '../utils/jwt.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/User.js';

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
    const user = await User.findById(decoded.sub).select('+refreshTokenVersion');
    if (!user) {
      throw new ApiError(401, 'User not found');
    }
    if (user.refreshTokenVersion !== decoded.rtv) {
      throw new ApiError(401, 'Session invalidated');
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
