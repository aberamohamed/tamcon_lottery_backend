import { z } from 'zod';

const envSchema = z
  .object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  APP_NAME: z.string().default('tamcon-lottery'),
  WEEKLY_DRAW_TIMEZONE: z.string().default('Africa/Addis_Ababa'),

  /** Full URI (local `mongodb://` or Atlas `mongodb+srv://...`). */
  MONGODB_URI: z.string().optional().default(''),
  /** Alternative to MONGODB_URI: build `mongodb+srv` from the following (Atlas). */
  MONGODB_ATLAS_HOST: z.string().optional().default(''),
  MONGODB_ATLAS_USER: z.string().optional().default(''),
  MONGODB_ATLAS_PASSWORD: z.string().optional().default(''),
  MONGODB_ATLAS_DBNAME: z.string().optional().default('tamcon_weekly_draw_lottery'),

  MONGODB_CONNECT_TIMEOUT_MS: z.coerce.number().min(5000).max(120000).default(60000),
  MONGODB_SERVER_SELECTION_TIMEOUT_MS: z.coerce.number().min(5000).max(120000).default(60000),
  MONGODB_SOCKET_TIMEOUT_MS: z.coerce.number().min(10000).max(600000).default(120000),
  MONGODB_FORCE_IPV4: z.preprocess(
    (val) => (val === undefined || val === '' ? 'true' : val),
    z
      .string()
      .transform((v) => v === 'true' || v === '1'),
  ),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  COOKIE_SECURE: z.preprocess(
    (val) => (val === undefined || val === '' ? 'false' : val),
    z
      .string()
      .transform((v) => v === 'true' || v === '1'),
  ),
  COOKIE_DOMAIN: z.string().optional().default(''),

  ALLOWED_ORIGINS: z.string().min(1),

  OTP_EXPIRES_MINUTES: z.coerce.number().min(1).max(30).default(5),

  MAIL_HOST: z.string().min(1),
  MAIL_PORT: z.coerce.number().default(587),
  MAIL_SECURE: z.preprocess(
    (val) => (val === undefined || val === '' ? 'false' : val),
    z
      .string()
      .transform((v) => v === 'true' || v === '1'),
  ),
  MAIL_USER: z.string().optional().default(''),
  MAIL_PASS: z.string().optional().default(''),
  MAIL_FROM: z.string().min(1),
  /** When true, OTP is printed to the server log instead of sending email. */
  MAIL_LOG_OTP_TO_CONSOLE: z.preprocess(
    (val) => (val === undefined || val === '' ? 'false' : val),
    z
      .string()
      .transform((v) => v === 'true' || v === '1'),
  ),

  CHAPA_SECRET_KEY: z.string().min(1),
  CHAPA_PUBLIC_KEY: z.string().optional().default(''),
  CHAPA_ENCRYPTION_KEY: z.string().optional().default(''),
  CHAPA_BASE_URL: z.string().url().default('https://api.chapa.co/v1'),
  /** From Dashboard → Settings → Webhooks (not the encryption key). Optional in development. */
  CHAPA_WEBHOOK_SECRET: z.string().optional().default(''),
  CHAPA_CALLBACK_URL: z.string().url(),
  
  BACKEND_URL: z.string().url().default('http://localhost:4000'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),

  TICKET_PRICE_ETB: z.coerce.number().positive().default(10),
  PRIZE_POOL_PERCENT: z.coerce.number().min(0).max(1).default(0.53),
  TICKET_NUMBER_DIGITS: z.coerce.number().min(6).max(12).default(8),
  })
  .superRefine((data, ctx) => {
    const uri = data.MONGODB_URI?.trim();
    const hasAtlas =
      Boolean(data.MONGODB_ATLAS_HOST?.trim()) &&
      Boolean(data.MONGODB_ATLAS_USER) &&
      Boolean(data.MONGODB_ATLAS_PASSWORD);
    if (!uri && !hasAtlas) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Set MONGODB_URI, or set MONGODB_ATLAS_HOST + MONGODB_ATLAS_USER + MONGODB_ATLAS_PASSWORD (see .env.example).',
        path: ['MONGODB_URI'],
      });
    }
    if (data.NODE_ENV === 'production' && !data.CHAPA_WEBHOOK_SECRET?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CHAPA_WEBHOOK_SECRET is required in production (Chapa Dashboard → Webhooks).',
        path: ['CHAPA_WEBHOOK_SECRET'],
      });
    }
  })
  .transform((data) => {
    let mongodbUri = data.MONGODB_URI?.trim() || '';
    if (!mongodbUri && data.MONGODB_ATLAS_HOST?.trim()) {
      const user = encodeURIComponent(data.MONGODB_ATLAS_USER);
      const pass = encodeURIComponent(data.MONGODB_ATLAS_PASSWORD);
      const host = data.MONGODB_ATLAS_HOST.trim();
      const db = (data.MONGODB_ATLAS_DBNAME || 'tamcon_weekly_draw_lottery').trim() || 'tamcon_weekly_draw_lottery';
      mongodbUri = `mongodb+srv://${user}:${pass}@${host}/${db}?retryWrites=true&w=majority`;
    }
    return { ...data, MONGODB_URI: mongodbUri };
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export function getAllowedOrigins() {
  return env.ALLOWED_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}
