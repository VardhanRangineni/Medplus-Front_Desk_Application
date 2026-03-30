/**
 * userService.js
 *
 * All backend communication for the User Master screen lives here.
 * When the API is ready:
 *   1. Set VITE_API_BASE_URL in your .env file.
 *   2. Uncomment the real fetch() calls below each TODO comment.
 *   3. Delete the mock helpers at the bottom of this file.
 *
 * Nothing in the UI component needs to change.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

// ─── Types (JSDoc) ────────────────────────────────────────────────────────────
/**
 * @typedef {Object} User
 * @property {string}  id           - Employee ID          (e.g. "EMP-001")
 * @property {string}  name         - Full name
 * @property {string}  role         - System role          (e.g. "Front Desk Officer")
 * @property {string}  designation  - Job designation      (e.g. "Senior Officer")
 * @property {string}  dept         - Department           (e.g. "Operations")
 * @property {string}  workLocation - Assigned branch/office
 * @property {string}  email        - Work email address
 * @property {string}  phone        - Contact number
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
 * Returns all users currently stored in the local DB.
 *
 * TODO: uncomment when backend is ready
 * Endpoint: GET /api/users
 *
 * @returns {Promise<User[]>}
 */
export async function getUsers() {
  // return request('/api/users');
  return _mockDelay(MOCK_USERS);
}

/**
 * Pulls all users from the external master DB via the backend,
 * saves them into the local DB, and returns the full saved list.
 *
 * This is what the "Fetch Users" button calls.
 *
 * TODO: uncomment when backend is ready
 * Endpoint: POST /api/users/sync
 *
 * @returns {Promise<User[]>}
 */
export async function syncUsersFromMaster() {
  // return request('/api/users/sync', { method: 'POST' });
  return _mockDelay(MOCK_USERS, 1200);
}

// ─── Mock helpers (delete when API is live) ───────────────────────────────────
function _mockDelay(data, ms = 400) {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

/** @type {User[]} */
const MOCK_USERS = [
  { id: 'EMP-001', name: 'Sunita Reddy',  role: 'Front Desk Officer', designation: 'Senior Officer',     dept: 'Operations', workLocation: 'Medplus Head Office',    email: 'sunita.reddy@medplus.in',  phone: '9823456789' },
  { id: 'EMP-002', name: 'Arjun Das',     role: 'Security Admin',     designation: 'Security In-charge', dept: 'Security',   workLocation: 'Medplus Head Office',    email: 'arjun.das@medplus.in',     phone: '9912300045' },
  { id: 'EMP-003', name: 'Kavita Rao',    role: 'Front Desk Officer', designation: 'Officer',            dept: 'Operations', workLocation: 'Branch - Banjara Hills', email: 'kavita.rao@medplus.in',    phone: '9845678901' },
  { id: 'EMP-004', name: 'Ravi Kumar',    role: 'HR Manager',         designation: 'Manager',            dept: 'HR',         workLocation: 'Medplus Head Office',    email: 'ravi.kumar@medplus.in',    phone: '9700123456' },
  { id: 'EMP-005', name: 'Priya Sharma',  role: 'Front Desk Officer', designation: 'Officer',            dept: 'Operations', workLocation: 'Branch - Kondapur',      email: 'priya.sharma@medplus.in',  phone: '9866554433' },
  { id: 'EMP-006', name: 'Ananya Singh',  role: 'Security Admin',     designation: 'Security Guard',     dept: 'Security',   workLocation: 'Branch - Banjara Hills', email: 'ananya.singh@medplus.in',  phone: '9988776655' },
  { id: 'EMP-007', name: 'Deepak Verma',  role: 'Front Desk Officer', designation: 'Senior Officer',     dept: 'Operations', workLocation: 'Branch - Gachibowli',    email: 'deepak.verma@medplus.in',  phone: '9876543210' },
];
