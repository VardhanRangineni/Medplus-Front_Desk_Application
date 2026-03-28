import { BASE_URL } from './apiClient';

/**
 * POST /auth/login
 * @param {{ username: string, password: string }} credentials
 * @returns {Promise<{ token: string, userName: string }>}
 * @throws {Error} with a human-readable message on failure
 *
 * The client IP is NOT sent in the body — the backend reads it directly
 * from the HTTP request (HttpServletRequest), which cannot be spoofed.
 */
export async function loginUser({ username, password }) {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const err = new Error(data.message || 'Something went wrong. Please try again.');
    if (data.errorCode) err.errorCode = data.errorCode;
    throw err;
  }

  return response.json();
}
