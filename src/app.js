import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';

import { env, getAllowedOrigins } from './config/env.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { router as apiRouter } from './routes/index.js';
import webhookRouter from './routes/webhook.routes.js';

const app = express();

// Trust reverse proxies (like Render, Heroku, or Nginx) to correctly read the user's real IP address.
app.set('trust proxy', 1);

// Important: Chapa webhooks require the raw request body buffer to verify SHA256 signatures securely.
app.use(
  '/api/v1/payments/chapa/webhook',
  express.raw({
    type: (req) => (req.headers['content-type'] || '').toLowerCase().includes('application/json'),
    limit: '1mb',
  }),
  webhookRouter,
);

// Set standard security-related HTTP headers to block clickjacking and other common exploits.
app.use(helmet());

// Enforce custom CORS policy (only allow domains listed in ALLOWED_ORIGINS).
app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      const allowed = getAllowedOrigins();
      if (!origin) {
        if (env.NODE_ENV === 'development') {
          return callback(null, true);
        }
        return callback(null, false);
      }
      if (allowed.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
  }),
);

// Enable reading cookies from incoming client requests.
app.use(cookieParser());

// Parse incoming request bodies in JSON format (with a safe 1MB size limit).
app.use(express.json({ limit: '1mb' }));

// Parse standard URL-encoded form submissions.
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
// Prevent NoSQL query injection attacks by sanitizing request bodies containing dollar signs ($) or dots.
app.use(
  mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ req }) => {
      if (env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.warn('Sanitized request', req.originalUrl);
      }
    },
  }),
);

// Register all main application routes.
app.use('/api/v1', apiRouter);

// A simple system health-check endpoint.
app.get('/health', (_req, res) => {
  res.json({ ok: true, env: env.NODE_ENV });
});

// A fallback handler for routes that do not match any defined endpoints (404).
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Not found' });
});

// Centralized error handling middleware to format and return errors to the client gracefully.
app.use(errorHandler);

export default app;
