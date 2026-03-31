/**
 * checkInOutService.js
 *
 * All backend communication for the Check-In / Check-Out screen.
 * When the API is ready:
 *   1. Set VITE_API_BASE_URL in your .env file.
 *   2. Uncomment the real fetch() calls and delete the mock helpers.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

// ─── Types (JSDoc) ────────────────────────────────────────────────────────────
/**
 * @typedef {'VISITOR'|'EMPLOYEE'} EntryType
 * @typedef {'checked-in'|'checked-out'} EntryStatus
 *
 * @typedef {Object} Member
 * @property {string}      id
 * @property {string}      name
 * @property {number|null} card
 * @property {EntryStatus} status
 *
 * @typedef {Object} Entry
 * @property {string}      id
 * @property {EntryType}   type
 * @property {string}      name
 * @property {string|null} mobile       - VISITOR only
 * @property {string|null} empId        - EMPLOYEE only
 * @property {EntryStatus} status
 * @property {string}      personToMeet
 * @property {number|null} card
 * @property {Date|null}   checkIn
 * @property {Date|null}   checkOut
 * @property {Member[]}    members      - sub-visitors (VISITOR only)
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
 * Fetches all check-in/check-out entries for the given date.
 *
 * TODO: uncomment when backend is ready
 * Endpoint: GET /api/visitors?date=YYYY-MM-DD
 *
 * @param {string} date - ISO date string (e.g. "2026-03-28")
 * @returns {Promise<Entry[]>}
 */
export async function getEntries(date) {
  // return request(`/api/visitors?date=${encodeURIComponent(date)}`);
  return _mockDelay(MOCK_ENTRIES);
}

/**
 * Checks out a main entry (visitor or employee).
 *
 * TODO: uncomment when backend is ready
 * Endpoint: PATCH /api/visitors/:id/checkout
 *
 * @param {string} id
 * @returns {Promise<Entry>}
 */
export async function checkOutEntry(id) {
  // return request(`/api/visitors/${encodeURIComponent(id)}/checkout`, { method: 'PATCH' });
  return _mockDelay({ id, status: 'checked-out', checkOut: new Date().toISOString() }, 300);
}

/**
 * Checks out a single member within a visitor group.
 *
 * TODO: uncomment when backend is ready
 * Endpoint: PATCH /api/visitors/:entryId/members/:memberId/checkout
 *
 * @param {string} entryId
 * @param {string} memberId
 * @returns {Promise<Member>}
 */
export async function checkOutMember(entryId, memberId) {
  // return request(
  //   `/api/visitors/${encodeURIComponent(entryId)}/members/${encodeURIComponent(memberId)}/checkout`,
  //   { method: 'PATCH' }
  // );
  return _mockDelay({ id: memberId, status: 'checked-out' }, 300);
}

// ─── Mock helpers (delete when API is live) ───────────────────────────────────
function _mockDelay(data, ms = 450) {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

/** @type {Entry[]} */
export const MOCK_ENTRIES = [
  {
    id: 'V001',
    type: 'VISITOR',
    name: 'Prabhas',
    mobile: '1234567890',
    empId: null,
    status: 'checked-in',
    personToMeet: 'Amit Sharma',
    card: 77,
    checkIn: new Date('2026-03-28T10:43:00'),
    checkOut: null,
    members: [
      { id: 'M001a', name: 'Ram Charan', card: 78, status: 'checked-out' },
    ],
  },
  {
    id: 'E001',
    type: 'EMPLOYEE',
    name: 'Vardhan R',
    mobile: null,
    empId: 'EHP1001',
    status: 'checked-in',
    personToMeet: 'Priya Verma',
    card: null,
    checkIn: new Date('2026-03-28T10:37:00'),
    checkOut: null,
    members: [],
  },
  {
    id: 'V002',
    type: 'VISITOR',
    name: 'Rohit',
    mobile: '9949592611',
    empId: null,
    status: 'checked-in',
    personToMeet: 'Sunita Reddy',
    card: 44,
    checkIn: new Date('2026-03-28T10:38:00'),
    checkOut: null,
    members: [
      { id: 'M002a', name: 'Virat Kohli',   card: 45, status: 'checked-in' },
      { id: 'M002b', name: 'Rohit Sharma',  card: 46, status: 'checked-in' },
    ],
  },
  {
    id: 'E002',
    type: 'EMPLOYEE',
    name: 'Prabhas',
    mobile: null,
    empId: 'EMP1001',
    status: 'checked-out',
    personToMeet: 'Amit Sharma',
    card: null,
    checkIn: new Date('2026-03-27T18:29:00'),
    checkOut: new Date('2026-03-27T20:00:00'),
    members: [],
  },
  {
    id: 'V003',
    type: 'VISITOR',
    name: 'Vardhan',
    mobile: '9949592611',
    empId: null,
    status: 'checked-out',
    personToMeet: 'Sunita Reddy',
    card: 12,
    checkIn: new Date('2026-03-27T16:58:00'),
    checkOut: new Date('2026-03-27T18:30:00'),
    members: [
      { id: 'M003a', name: 'Ananya Singh', card: 13, status: 'checked-out' },
      { id: 'M003b', name: 'Deepak Nair',  card: 14, status: 'checked-out' },
    ],
  },
];
