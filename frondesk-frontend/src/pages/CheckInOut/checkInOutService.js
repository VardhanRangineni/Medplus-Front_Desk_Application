/**
 * checkInOutService.js
 *
 * All backend communication for the Check-In / Check-Out screen.
 * Uses window.electronAPI.apiRequest() — token injected automatically by main process.
 *
 * Endpoints:
 *   GET    /api/visitors?date=YYYY-MM-DD
 *   PATCH  /api/visitors/:id/checkout
 *   PATCH  /api/visitors/:id/members/:memberId/checkout
 */

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
 * @property {string}      id             - e.g. "MED-V-0001" or "MED-GV-0001"
 * @property {EntryType}   type           - "VISITOR" or "EMPLOYEE"
 * @property {string}      name
 * @property {string|null} mobile
 * @property {string|null} empId
 * @property {EntryStatus} status
 * @property {string}      personToMeet   - full name of person being visited
 * @property {number|null} card
 * @property {Date|null}   checkIn
 * @property {Date|null}   checkOut
 * @property {Member[]}    members
 */

// ─── Private helper ───────────────────────────────────────────────────────────

async function api(method, path, body) {
  const result = await window.electronAPI.apiRequest(method, path, body);
  if (!result.ok) {
    const msg = result.body?.message || `Request failed: ${result.status}`;
    throw new Error(msg);
  }
  return result.body?.data ?? result.body;
}

/** Maps a raw API response entry to a UI-ready Entry (ISO strings → Date objects). */
function normalise(raw) {
  return {
    ...raw,
    checkIn:  raw.checkIn  ? new Date(raw.checkIn)  : null,
    checkOut: raw.checkOut ? new Date(raw.checkOut) : null,
    members:  (raw.members ?? []).map((m) => ({ ...m })),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetches all check-in/check-out entries for the caller's location on the given date.
 * Defaults to today on the backend when date is omitted.
 *
 * Endpoint: GET /api/visitors?date=YYYY-MM-DD
 *
 * @param {string} [date] - ISO date string (e.g. "2026-03-28")
 * @returns {Promise<Entry[]>}
 */
export async function getEntries(date) {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  const data  = await api('GET', `/api/visitors${query}`);
  return Array.isArray(data) ? data.map(normalise) : [];
}

/**
 * Checks out a main entry (visitor or employee).
 *
 * Endpoint: PATCH /api/visitors/:id/checkout
 *
 * @param {string} id
 * @returns {Promise<Entry>}
 */
export async function checkOutEntry(id) {
  const data = await api('PATCH', `/api/visitors/${encodeURIComponent(id)}/checkout`);
  return normalise(data);
}

/**
 * Checks out a single member within a group visit.
 *
 * Endpoint: PATCH /api/visitors/:entryId/members/:memberId/checkout
 *
 * @param {string} entryId
 * @param {string} memberId
 * @returns {Promise<Member>}
 */
export async function checkOutMember(entryId, memberId) {
  return api(
    'PATCH',
    `/api/visitors/${encodeURIComponent(entryId)}/members/${encodeURIComponent(memberId)}/checkout`
  );
}
