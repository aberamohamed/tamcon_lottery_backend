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

app.set('trust proxy', 1);

app.use(
  '/api/v1/payments/chapa/webhook',
  express.raw({
    type: (req) => (req.headers['content-type'] || '').toLowerCase().includes('application/json'),
    limit: '1mb',
  }),
  webhookRouter,
);

app.use(helmet());
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
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
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

app.use('/api/v1', apiRouter);

app.get('/health', (_req, res) => {
  res.json({ ok: true, env: env.NODE_ENV });
});

app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Not found' });
});

app.use(errorHandler);

export default app;
