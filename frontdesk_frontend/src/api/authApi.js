import { BASE_URL } from './apiClient';

/**
 * POST /auth/login
 * @param {{ username: string, password: string }} credentials
 * @returns {Promise<{ token: string, userName: string }>}
 * @throws {Error} with a human-readable message on failure
 */
export async function loginUser({ username, password }) {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Invalid username or password. Please try again.');
    }
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'Something went wrong. Please try again.');
  }

  return response.json();
}
