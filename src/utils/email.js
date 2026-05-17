// Normalize email to standard lowercase format to avoid duplicate records
export function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}
