/**
 * userManagementService.js
 *
 * All backend communication for the User Management screen.
 * When the API is ready:
 *   1. Set VITE_API_BASE_URL in your .env file.
 *   2. Uncomment the real fetch() calls and delete the mock helpers.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

// ─── Types (JSDoc) ────────────────────────────────────────────────────────────
/**
 * @typedef {Object} ManagedUser
 * @property {string}  id          - Employee ID       (e.g. "EMP-001")
 * @property {string}  name        - Full name
 * @property {string}  location    - Assigned branch/office
 * @property {string}  ipAddress   - Device IP address
 * @property {string}  macAddress  - Device MAC address
 * @property {boolean} status      - true = Active, false = Inactive
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
 * Returns all managed users from the local DB.
 *
 * TODO: uncomment when backend is ready
 * Endpoint: GET /api/managed-users
 *
 * @returns {Promise<ManagedUser[]>}
 */
export async function getManagedUsers() {
  // return request('/api/managed-users');
  return _mockDelay(MOCK_USERS);
}

/**
 * Creates a new managed user.
 *
 * TODO: uncomment when backend is ready
 * Endpoint: POST /api/managed-users
 *
 * @param {Omit<ManagedUser, 'id'>} payload
 * @returns {Promise<ManagedUser>}
 */
export async function createManagedUser(payload) {
  // return request('/api/managed-users', {
  //   method: 'POST',
  //   body: JSON.stringify(payload),
  // });
  const newUser = { ...payload, id: `EMP-${String(Date.now()).slice(-4)}` };
  return _mockDelay(newUser, 350);
}

/**
 * Updates an existing managed user.
 *
 * TODO: uncomment when backend is ready
 * Endpoint: PUT /api/managed-users/:id
 *
 * @param {string}      id
 * @param {ManagedUser} payload
 * @returns {Promise<ManagedUser>}
 */
export async function updateManagedUser(id, payload) {
  // return request(`/api/managed-users/${encodeURIComponent(id)}`, {
  //   method: 'PUT',
  //   body: JSON.stringify(payload),
  // });
  return _mockDelay({ ...payload, id }, 350);
}

/**
 * Toggles the active/inactive status of a managed user.
 *
 * TODO: uncomment when backend is ready
 * Endpoint: PATCH /api/managed-users/:id/status
 *
 * @param {string}  id
 * @param {boolean} status
 * @returns {Promise<ManagedUser>}
 */
export async function updateManagedUserStatus(id, status) {
  // return request(`/api/managed-users/${encodeURIComponent(id)}/status`, {
  //   method: 'PATCH',
  //   body: JSON.stringify({ status }),
  // });
  return _mockDelay({ id, status }, 250);
}

// ─── Mock helpers (delete when API is live) ───────────────────────────────────
function _mockDelay(data, ms = 400) {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

/** @type {ManagedUser[]} */
const MOCK_USERS = [
  { id: 'EMP-001', name: 'Sunita Reddy',  location: 'Medplus Head Office',    ipAddress: '192.168.1.101', macAddress: 'A4:C3:F0:11:22:33', status: true  },
  { id: 'EMP-002', name: 'Arjun Das',     location: 'Medplus Head Office',    ipAddress: '192.168.1.102', macAddress: 'B8:27:EB:44:55:66', status: true  },
  { id: 'EMP-003', name: 'Kavita Rao',    location: 'Branch - Banjara Hills', ipAddress: '192.168.2.101', macAddress: 'DC:A6:32:77:88:99', status: true  },
  { id: 'EMP-004', name: 'Ravi Kumar',    location: 'Medplus Head Office',    ipAddress: '192.168.1.104', macAddress: '00:1A:2B:CC:DD:EE', status: false },
  { id: 'EMP-005', name: 'Priya Sharma',  location: 'Branch - Kondapur',      ipAddress: '192.168.3.101', macAddress: 'F4:5C:89:AB:CD:EF', status: true  },
  { id: 'EMP-006', name: 'Ananya Singh',  location: 'Branch - Banjara Hills', ipAddress: '192.168.2.102', macAddress: '3C:22:FB:12:34:56', status: false },
  { id: 'EMP-007', name: 'Deepak Verma',  location: 'Branch - Gachibowli',    ipAddress: '192.168.4.101', macAddress: '08:00:27:78:9A:BC', status: true  },
];
