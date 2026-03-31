/**
 * userService.js
 *
 * All backend communication for the User Master screen.
 *
 * Architecture note (Electron):
 *   HTTP requests are routed through the main-process IPC bridge via
 *   window.electronAPI.apiRequest(). This keeps the JWT token inside
 *   the main process and avoids renderer-side CSP restrictions.
 *
 * Backend base path : /api/users
 * Auth              : Bearer token is injected automatically by main.js
 * Response envelope : ApiResponse<T> → { success, message, data, timestamp }
 */

// ─── Types (JSDoc) ────────────────────────────────────────────────────────────

/**
 * @typedef {Object} User
 * @property {string} id           - Employee ID          (e.g. "EMP-001")
 * @property {string} name         - Full name
 * @property {string} role         - Display role         (e.g. "Front Desk Officer")
 * @property {string} designation  - Job designation
 * @property {string} dept         - Department
 * @property {string} workLocation - Assigned branch / office
 * @property {string} email        - Work email address
 * @property {string} phone        - Contact number
 */

// ─── Core request helper ──────────────────────────────────────────────────────

/**
 * Sends an authenticated API call via the Electron IPC bridge.
 * The JWT Bearer token is injected by the main process automatically.
 *
 * @param {'GET'|'POST'|'PUT'|'PATCH'|'DELETE'} method
 * @param {string} path   - API path, may include query string
 * @param {object} [body] - Request body; omit for GET/DELETE
 * @returns {Promise<*>}  Resolves with `response.body.data`
 * @throws {ApiError}     On network failure or non-2xx HTTP status
 */
async function request(method, path, body) {
  const result = await window.electronAPI.apiRequest(method, path, body ?? null);

  if (result.error) {
    throw new ApiError('Cannot reach the server. Check your network connection.', 0);
  }

  if (!result.ok) {
    const message = result.body?.message ?? `Request failed with status ${result.status}.`;
    throw new ApiError(message, result.status);
  }

  return result.body?.data;
}

/**
 * Structured error type so callers can distinguish HTTP errors from
 * network failures and handle them differently if needed.
 */
export class ApiError extends Error {
  /** @param {string} message @param {number} status */
  constructor(message, status) {
    super(message);
    this.name   = 'ApiError';
    this.status = status;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns all employees currently stored in the local usermaster table.
 *
 * Endpoint: GET /api/users
 *
 * @returns {Promise<User[]>}
 */
export async function getUsers() {
  return request('GET', '/api/users');
}

/**
 * Pulls the latest employee data from the external HR API via the backend,
 * upserts into the local usermaster table, and returns the full updated list.
 * Called by the "Fetch Users" button.
 *
 * Endpoint: POST /api/users/sync
 *
 * @returns {Promise<User[]>}
 */
export async function syncUsersFromMaster() {
  return request('POST', '/api/users/sync');
}
