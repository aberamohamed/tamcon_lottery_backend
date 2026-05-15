import { chapaConfig } from '../config/chapa.js';
import { ApiError } from '../utils/ApiError.js';

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
    throw new ApiError(502, data.message || 'Chapa request failed', data);
  }
  return data;
}

export async function initializeTransaction(payload) {
  return chapaFetch('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function verifyTransaction(txRef) {
  return chapaFetch(`/transaction/verify/${encodeURIComponent(txRef)}`, {
    method: 'GET',
  });
}
