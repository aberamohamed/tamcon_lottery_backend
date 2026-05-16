import { chapaConfig } from '../config/chapa.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Internal helper to make HTTP requests to the Chapa API.
 * Automatically adds the Authorization header and handles error parsing.
 * 
 * @param {string} path - The API endpoint path (e.g., '/transaction/initialize').
 * @param {Object} [options={}] - Additional options for the fetch call.
 * @returns {Promise<Object>} The parsed JSON response from the API.
 * @throws {ApiError} If the request fails or returns a non-ok status.
 */
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

/**
 * Initializes a new payment transaction with Chapa.
 * 
 * @param {Object} payload - The transaction details including amount, email, first_name, last_name, tx_ref, etc.
 * @returns {Promise<Object>} The response from Chapa, typically containing a checkout_url.
 */
export async function initializeTransaction(payload) { //create checkout
  return chapaFetch('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Verifies the status of an existing Chapa transaction.
 * 
 * @param {string} txRef - The unique transaction reference to verify.
 * @returns {Promise<Object>} The response from Chapa containing the transaction status and details.
 */
export async function verifyTransaction(txRef) {
  return chapaFetch(`/transaction/verify/${encodeURIComponent(txRef)}`, {
    method: 'GET',
    redirect: 'follow',
  });
}
