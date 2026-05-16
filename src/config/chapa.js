import { env } from './env.js';

export const chapaConfig = {
  secretKey: env.CHAPA_SECRET_KEY,
  publicKey: env.CHAPA_PUBLIC_KEY,
  encryptionKey: env.CHAPA_ENCRYPTION_KEY,
  baseUrl: env.CHAPA_BASE_URL.replace(/\/$/, ''),
  webhookSecret: env.CHAPA_WEBHOOK_SECRET?.trim() || '',
  callbackUrl: env.CHAPA_CALLBACK_URL,
  returnUrl: env.CHAPA_CALLBACK_URL,
};
