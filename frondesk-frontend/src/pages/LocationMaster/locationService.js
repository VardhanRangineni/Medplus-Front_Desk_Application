/**
 * locationService.js
 *
 * All backend communication for the Location Master screen lives here.
 * When your friend's API is ready:
 *   1. Set VITE_API_BASE_URL in your .env file.
 *   2. Uncomment the real fetch() calls below each TODO comment.
 *   3. Delete the mock helpers at the bottom of this file.
 *
 * Nothing in the UI component needs to change.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

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

// ─── API helpers ──────────────────────────────────────────────────────────────
async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `Request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns all locations currently stored in the local DB.
 *
 * TODO: uncomment when backend is ready
 * Endpoint: GET /api/locations
 *
 * @returns {Promise<Location[]>}
 */
export async function getLocations() {
  // return request('/api/locations');
  return _mockDelay(MOCK_LOCATIONS);
}

/**
 * Pulls all locations from the external master DB via the backend,
 * saves them into the local DB, and returns the full saved list.
 *
 * This is what the "Fetch Locations" button calls.
 *
 * TODO: uncomment when backend is ready
 * Endpoint: POST /api/locations/sync
 *
 * @returns {Promise<Location[]>}
 */
export async function syncLocationsFromMaster() {
  // return request('/api/locations/sync', { method: 'POST' });
  return _mockDelay(MOCK_LOCATIONS, 1200);
}

/**
 * Toggles the active/inactive status of a single location in the local DB.
 *
 * TODO: uncomment when backend is ready
 * Endpoint: PATCH /api/locations/:code/status
 *
 * @param {string}  code
 * @param {boolean} status
 * @returns {Promise<Location>}
 */
export async function updateLocationStatus(code, status) {
  // return request(`/api/locations/${encodeURIComponent(code)}/status`, {
  //   method: 'PATCH',
  //   body: JSON.stringify({ status }),
  // });
  return _mockDelay({ code, status }, 250);
}

// ─── Mock helpers (delete when API is live) ───────────────────────────────────
function _mockDelay(data, ms = 400) {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

/** @type {Location[]} */
const MOCK_LOCATIONS = [
  { code: 'LOC-001', name: 'Medplus Head Office',    address: '8-2-293, Road No. 78, Jubilee Hills', city: 'Hyderabad', state: 'Telangana', status: true  },
  { code: 'LOC-002', name: 'Branch - Banjara Hills', address: '6-3-871, Banjara Hills',              city: 'Hyderabad', state: 'Telangana', status: true  },
  { code: 'LOC-003', name: 'Branch - Kondapur',      address: 'Plot 42, Kondapur Main Road',         city: 'Hyderabad', state: 'Telangana', status: true  },
  { code: 'LOC-004', name: 'Branch - Madhapur',      address: '2-49, HITEC City, Madhapur',          city: 'Hyderabad', state: 'Telangana', status: false },
  { code: 'LOC-005', name: 'Branch - Gachibowli',    address: 'Plot 18, Gachibowli Junction',        city: 'Hyderabad', state: 'Telangana', status: true  },
];
