/**
 * locationService.js
 *
 * All backend communication for the Location Master screen.
 *
 * Architecture note (Electron):
 *   HTTP requests are routed through the main-process IPC bridge via
 *   window.electronAPI.apiRequest(). This keeps the JWT token inside
 *   the main process and avoids renderer-side CSP restrictions.
 *
 * Backend base path : /api/locations
 * Auth              : Bearer token is injected automatically by main.js
 * Response envelope : ApiResponse<T> → { success, message, data, timestamp }
 */

// ─── Types (JSDoc) ────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Location
 * @property {string}  code    - Unique location code  (e.g. "LOC-001")
 * @property {string}  name    - Display name
 * @property {string}  address - Street address
 * @property {string}  city    - City
 * @property {string}  state   - State
 * @property {boolean} status  - true = Active, false = Inactive
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
 * Type-ahead search over locationmaster by descriptive name or LocationId.
 * Used to auto-fill the Location field in the Add / Edit User modal.
 *
 * Endpoint: GET /api/locations/search?q=<term>
 *
 * @param {string} [q=''] - Search term (empty string returns empty array)
 * @returns {Promise<Location[]>}
 */
export async function searchLocations(q = '') {
  return request('GET', `/api/locations/search?q=${encodeURIComponent(q)}`);
}

/**
 * Returns one page of locations from the local locationmaster table.
 * Supports optional full-text search over LocationId, name, and city.
 *
 * Endpoint: GET /api/locations?page=&size=&q=
 *
 * @param {Object} [options]
 * @param {number} [options.page=0]   0-based page index
 * @param {number} [options.size=20]  records per page
 * @param {string} [options.search]   optional search term
 * @returns {Promise<{ content: Location[], totalElements: number, totalPages: number, page: number }>}
 */
export async function getLocations({ page = 0, size = 20, search = '' } = {}) {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (search.trim()) params.set('q', search.trim());
  return request('GET', `/api/locations?${params}`);
}

/**
 * Pulls the latest location data from the external HR API via the backend,
 * upserts into the local locationmaster table, and returns the full updated list.
 * Called by the "Fetch Locations" button.
 *
 * Endpoint: POST /api/locations/sync
 *
 * @returns {Promise<Location[]>}
 */
export async function syncLocationsFromMaster() {
  return request('POST', '/api/locations/sync');
}

/**
 * Toggles the active / inactive status of a single location.
 *
 * Endpoint: PATCH /api/locations/:code/status
 *
 * @param {string}  code
 * @param {boolean} status - true = activate, false = deactivate
 * @returns {Promise<Location>}
 */
export async function updateLocationStatus(code, status) {
  return request('PATCH', `/api/locations/${encodeURIComponent(code)}/status`, { status });
}
