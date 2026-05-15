import crypto from 'crypto';

export function verifyChapaSignature(rawBody, headers, secret) {
  if (!secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const sig =
    headers['x-chapa-signature'] ||
    headers['X-Chapa-Signature'] ||
    headers['chapa-signature'] ||
    headers['Chapa-Signature'];
  if (!sig || typeof sig !== 'string') return false;
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(String(sig).trim(), 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
