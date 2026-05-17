import { chapaConfig } from '../config/chapa.js';
import { ApiError } from '../utils/ApiError.js';

// Quick internal helper to talk to Chapa. Appends the Authorization headers and extracts JSON.
async function chapaFetch(path, options = {}) {
  const url = `${chapaConfig.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${chapaConfig.secretKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const message = typeof data.message === 'object' ? JSON.stringify(data.message) : (data.message || 'Chapa request failed');
    throw new ApiError(502, message, data);
  }
  return data;
}

// Tell Chapa to initialize a payment (returns the redirect checkout link).
export async function initializeTransaction(payload) { //create checkout
  return chapaFetch('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Verify a payment status with Chapa using the custom transaction ref.
export async function verifyTransaction(txRef) {
  return chapaFetch(`/transaction/verify/${encodeURIComponent(txRef)}`, {
    method: 'GET',
    redirect: 'follow',
  });
}
