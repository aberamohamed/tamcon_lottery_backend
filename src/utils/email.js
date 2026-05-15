/** Canonical email for queries and OTP storage (must match across request + verify). */
export function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}
