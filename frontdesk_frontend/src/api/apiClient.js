// Base URL comes from the Vite env variable; falls back to local dev server.
// Set VITE_API_BASE_URL in .env for every environment.
export const BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

/** Returns the JWT stored by the login flow (localStorage or sessionStorage). */
export function getAuthToken() {
  return (
    localStorage.getItem('authToken') ||
    sessionStorage.getItem('authToken') ||
    null
  );
}

/**
 * Clears all stored auth data without forcing a navigation.
 * Callers should display an error / login prompt themselves.
 */
export function clearAuthToken() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('userName');
  sessionStorage.removeItem('authToken');
  sessionStorage.removeItem('userName');
}

/**
 * Thin wrapper around fetch that:
 *  - Prefixes BASE_URL
 *  - Injects Authorization header when a token exists
 *  - On 401 / 403: clears stored token and throws a SessionExpiredError
 *  - On other non-2xx: throws a human-readable Error
 *
 * Callers are responsible for handling SessionExpiredError (show login prompt,
 * redirect, etc.) — this keeps navigation logic out of the API layer.
 *
 * @param {string} path  e.g. '/user/dashboard/overview'
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
export async function apiFetch(path, options = {}) {
  const token = getAuthToken();

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (response.status === 401 || response.status === 403) {
    clearAuthToken();
    const err = new Error('Session expired. Please log in again.');
    err.isAuthError = true;
    throw err;
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || `Request failed (${response.status})`);
  }

  return response.json();
}
