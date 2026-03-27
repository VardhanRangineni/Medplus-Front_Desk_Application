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
 * Thin wrapper around fetch that:
 *  - Prefixes BASE_URL
 *  - Injects Authorization header when a token exists
 *  - Throws a human-readable Error on non-2xx responses
 *
 * @param {string} path  e.g. '/api/dashboard/stats'
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

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || `Request failed (${response.status})`);
  }

  return response.json();
}
