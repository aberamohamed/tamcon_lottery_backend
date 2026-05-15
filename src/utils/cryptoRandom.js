import crypto from 'crypto';
import { env } from '../config/env.js';

const TEN = 10;

export function generateSixDigitOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

export function generateTicketNumber() {
  const digits = env.TICKET_NUMBER_DIGITS;
  const max = TEN ** digits;
  const n = crypto.randomInt(0, max);
  return String(n).padStart(digits, '0');
}

export function generateWinningNumber() {
  return generateTicketNumber();
}

export function generateTxRef(prefix = 'TX') {
  const rand = crypto.randomBytes(12).toString('hex');
  return `${prefix}_${Date.now()}_${rand}`;
}
