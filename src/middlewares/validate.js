import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';

export function validateBody(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body ?? {});
      next();
    } catch (e) {
      if (e instanceof ZodError) {
        return next(new ApiError(400, 'Validation failed', e.flatten()));
      }
      return next(e);
    }
  };
}

export function validateQuery(schema) {
  return (req, res, next) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (e) {
      if (e instanceof ZodError) {
        return next(new ApiError(400, 'Validation failed', e.flatten()));
      }
      return next(e);
    }
  };
}

export function validateParams(schema) {
  return (req, res, next) => {
    try {
      req.params = schema.parse(req.params);
      next();
    } catch (e) {
      if (e instanceof ZodError) {
        return next(new ApiError(400, 'Validation failed', e.flatten()));
      }
      return next(e);
    }
  };
}
