/**
 * userManagementService.js
 *
 * All backend communication for the User Management screen.
 *
 * Architecture note (Electron):
 *   HTTP requests are routed through the main-process IPC bridge via
 *   window.electronAPI.apiRequest(). This keeps the JWT token inside
 *   the main process and avoids renderer-side CSP restrictions.
 *
 * Backend base path : /api/managed-users
 * Auth              : Bearer token is injected automatically by main.js
 * Response envelope : ApiResponse<T> → { success, message, data, timestamp }
 */

// ─── Types (JSDoc) ────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ManagedUser
 * @property {string}  id          - Employee ID            (e.g. "EMP-001")
 * @property {string}  name        - Full name
 * @property {string}  location    - Assigned branch/office (descriptive name)
 * @property {string}  ipAddress   - Device IP address
 * @property {string}  macAddress  - Device MAC address
 * @property {boolean} status      - true = Active, false = Inactive
 */

/**
 * @typedef {Object} UserLookup
 * @property {string} id
 * @property {string} name
 * @property {string} location
 * @property {string} designation
 * @property {string} department
 * @property {string} email
 * @property {string} phone
 */

// ─── Core request helper ──────────────────────────────────────────────────────

/**
 * Sends an authenticated API call via the Electron IPC bridge.
 * The JWT Bearer token is injected by the main process automatically.
 *
 * @param {'GET'|'POST'|'PUT'|'PATCH'|'DELETE'} method
 * @param {string} path   - API path, may include query string
 * @param {object} [body] - Request body; omit / pass undefined for GET/DELETE
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
    this.name    = 'ApiError';
    this.status  = status;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Type-ahead lookup over the user master by employee ID or full name.
 * Used to auto-fill the Add / Edit User modal.
 *
 * Endpoint: GET /api/managed-users/search?q=<term>
 *
 * @param {string} [q=''] - Search term (empty string returns empty array)
 * @returns {Promise<UserLookup[]>}
 */
export async function searchUsers(q = '') {
  return request('GET', `/api/managed-users/search?q=${encodeURIComponent(q)}`);
}

/**
 * Returns one page of managed users from the local database.
 * Supports optional full-text search over id, name, ip, and mac.
 *
 * Endpoint: GET /api/managed-users?page=&size=&q=
 *
 * @param {Object} [options]
 * @param {number} [options.page=0]   0-based page index
 * @param {number} [options.size=20]  records per page
 * @param {string} [options.search]   optional search term
 * @returns {Promise<{ content: ManagedUser[], totalElements: number, totalPages: number, page: number }>}
 */
export async function getManagedUsers({ page = 0, size = 20, search = '' } = {}) {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (search.trim()) params.set('q', search.trim());
  return request('GET', `/api/managed-users?${params}`);
}

/**
 * Creates a new managed user record.
 * The backend defaults role to RECEPTIONIST and password to BCrypt(employeeId).
 *
 * Endpoint: POST /api/managed-users
 *
 * @param {ManagedUser} payload
 * @returns {Promise<ManagedUser>}
 */
export async function createManagedUser(payload) {
  return request('POST', '/api/managed-users', payload);
}

/**
 * Updates an existing managed user (name, location, IP, MAC, status).
 *
 * Endpoint: PUT /api/managed-users/:id
 *
 * @param {string}      id
 * @param {ManagedUser} payload
 * @returns {Promise<ManagedUser>}
 */
export async function updateManagedUser(id, payload) {
  return request('PUT', `/api/managed-users/${encodeURIComponent(id)}`, payload);
}

/**
 * Toggles the active / inactive status of a managed user.
 *
 * Endpoint: PATCH /api/managed-users/:id/status
 *
 * @param {string}  id
 * @param {boolean} status - true = activate, false = deactivate
 * @returns {Promise<ManagedUser>}
 */
export async function updateManagedUserStatus(id, status) {
  return request('PATCH', `/api/managed-users/${encodeURIComponent(id)}/status`, { status });
}
