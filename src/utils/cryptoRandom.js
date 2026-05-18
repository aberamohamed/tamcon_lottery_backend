// Cryptographically secure random generators for IDs, ticket numbers, and OTP codes.
import crypto from 'crypto';
import { env } from '../config/env.js';

const TEN = 10;

// Generate a secure 6-digit number string for email logins.
export function generateSixDigitOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

// Generate a random ticket code with length matching the TICKET_NUMBER_DIGITS environment setting.
export function generateTicketNumber() {
  const digits = env.TICKET_NUMBER_DIGITS;
  const max = TEN ** digits;
  const n = crypto.randomInt(0, max);
  return String(n).padStart(digits, '0');
}

export function generateWinningNumber() {
  return generateTicketNumber();
}

// Create a unique transaction reference with custom prefix (e.g. for payments/audits).
export function generateTxRef(prefix = 'TX') {
  const rand = crypto.randomBytes(12).toString('hex');
  return `${prefix}_${Date.now()}_${rand}`;
}
