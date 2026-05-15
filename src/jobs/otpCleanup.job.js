import { cleanupExpiredOtps } from '../services/otp.service.js';

const ONE_HOUR_MS = 60 * 60 * 1000;

export function startOtpCleanupJob() {
  setInterval(() => {
    cleanupExpiredOtps().catch(() => {});
  }, ONE_HOUR_MS);
}
