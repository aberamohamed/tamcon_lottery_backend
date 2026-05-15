import { ApiError } from '../utils/ApiError.js';

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
  let message = err.message || 'Internal server error';

  if (err.name === 'DocumentNotFoundError') {
    status = 404;
    message = 'Account record could not be updated. Check the user exists in MongoDB with a valid _id.';
  } else if (status === 500 && process.env.NODE_ENV === 'production' && !(err instanceof ApiError)) {
    message = 'Internal server error';
  }

  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  res.status(status).json({
    success: false,
    message,
    ...(err instanceof ApiError && err.details ? { details: err.details } : {}),
  });
}
