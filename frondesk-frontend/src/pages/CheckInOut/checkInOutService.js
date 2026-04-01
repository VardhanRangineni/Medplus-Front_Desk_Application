/**
 * checkInOutService.js
 *
 * All backend communication and data-export utilities for the Check-In / Check-Out screen.
 * Uses window.electronAPI.apiRequest() — token injected automatically by main process.
 *
 * Endpoints consumed:
 *   GET    /api/visitors?page=&size=&status=&department=&date=
 *   GET    /api/visitors/search?q=&page=&size=&status=&department=&date=
 *   GET    /api/visitors/status-counts
 *   PATCH  /api/visitors/:id/checkout
 *   PATCH  /api/visitors/:id/members/:memberId/checkout
 *   GET    /api/visitors/:id
 *   PUT    /api/visitors/:id
 */

import * as XLSX from 'xlsx';

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
 * @property {string}      id             - e.g. "MED-V-0001"
 * @property {EntryType}   type           - "VISITOR" or "EMPLOYEE"
 * @property {string}      name
 * @property {string|null} mobile
 * @property {string|null} empId
 * @property {EntryStatus} status
 * @property {string}      personToMeet   - full name of the host
 * @property {string|null} department     - host department
 * @property {number|null} card
 * @property {Date|null}   checkIn
 * @property {Date|null}   checkOut
 * @property {Member[]}    members
 *
 * @typedef {Object} EntriesPage
 * @property {Entry[]} entries
 * @property {number}  totalElements  - total matching records across all pages
 * @property {number}  totalPages
 * @property {number}  page           - 0-based index of the returned page
 *
 * @typedef {Object} StatusCounts
 * @property {number} total
 * @property {number} checkedIn
 * @property {number} checkedOut
 */

// ─── Private helpers ──────────────────────────────────────────────────────────

async function api(method, path, body) {
  const result = await window.electronAPI.apiRequest(method, path, body ?? null);
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

/** Formats a Date for display in the exported Excel sheet. */
function fmtDate(date) {
  if (!date) return '';
  return (
    date.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    }) +
    ' ' +
    date.toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    })
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetches one page of check-in/check-out entries using server-side pagination.
 *
 * When `options.search` is non-empty, the full-text search endpoint is used
 * (/api/visitors/search?q=…); otherwise the standard list endpoint is used.
 *
 * All filters are passed to the backend — no client-side filtering is applied.
 *
 * @param {Object}  [options]
 * @param {number}  [options.page=0]         - 0-based page index
 * @param {number}  [options.size=20]        - records per page
 * @param {string}  [options.search]         - full-text search query (name, mobile, empId, …)
 * @param {string}  [options.status]         - "checked-in" | "checked-out" | null
 * @param {string}  [options.department]     - department filter
 * @param {string}  [options.date]           - ISO date "YYYY-MM-DD" (null = all dates)
 * @returns {Promise<EntriesPage>}
 */
export async function getEntries({
  page       = 0,
  size       = 20,
  search     = '',
  status     = null,
  department = null,
  date       = null,
} = {}) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('size', String(size));
  if (status)     params.set('status',     status);
  if (department) params.set('department', department);
  if (date)       params.set('date',       date);

  const trimmed = search.trim();
  const endpoint = trimmed
    ? `/api/visitors/search?q=${encodeURIComponent(trimmed)}&${params}`
    : `/api/visitors?${params}`;

  const data = await api('GET', endpoint);

  // Backend always returns a PagedResponseDto: { content, totalElements, totalPages, page, … }
  const content = Array.isArray(data?.content) ? data.content : [];
  return {
    entries:       content.map(normalise),
    totalElements: data?.totalElements ?? content.length,
    totalPages:    data?.totalPages    ?? 1,
    page:          data?.page          ?? page,
  };
}

/**
 * Returns aggregate counts by visit status for the caller's location.
 * Used to populate the "All / Checked-in / Checked-out" tab badges.
 *
 * Endpoint: GET /api/visitors/status-counts
 *
 * @returns {Promise<StatusCounts>}
 */
export async function getStatusCounts() {
  const data = await api('GET', '/api/visitors/status-counts');
  return {
    total:      data?.total      ?? 0,
    checkedIn:  data?.checkedIn  ?? 0,
    checkedOut: data?.checkedOut ?? 0,
  };
}

/**
 * Returns the list of distinct department names that appear in the visitor log.
 * Used to populate the "Filter by Dept" dropdown dynamically.
 *
 * Endpoint: GET /api/visitors/log-departments
 *
 * @returns {Promise<string[]>}
 */
export async function getDepartments() {
  const data = await api('GET', '/api/visitors/log-departments');
  return Array.isArray(data) ? data : [];
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
    `/api/visitors/${encodeURIComponent(entryId)}/members/${encodeURIComponent(memberId)}/checkout`,
  );
}

/**
 * Fetches the full details of a single entry (includes photo, email, govtId, etc.)
 *
 * Endpoint: GET /api/visitors/:id
 *
 * @param {string} id
 * @returns {Promise<Entry>}
 */
export async function getEntryDetail(id) {
  const data = await api('GET', `/api/visitors/${encodeURIComponent(id)}`);
  return normalise(data);
}

/**
 * Updates an existing entry (visitor or employee).
 *
 * Endpoint: PUT /api/visitors/:id
 *
 * @param {string} id
 * @param {object} payload
 * @returns {Promise<Entry>}
 */
export async function updateEntry(id, payload) {
  const data = await api('PUT', `/api/visitors/${encodeURIComponent(id)}`, payload);
  return normalise(data);
}

// ─── Excel export ─────────────────────────────────────────────────────────────

/**
 * Generates an Excel (.xlsx) file from the supplied entries and triggers a
 * browser-style download inside Electron.
 *
 * Call this with the CURRENTLY VISIBLE PAGE entries, or pre-fetch all pages
 * for a "full export".  Column order mirrors the on-screen table.
 *
 * @param {Entry[]} entries    - Rows to export.
 * @param {string}  [filename] - Defaults to "visitors_YYYY-MM-DD.xlsx".
 */
export function exportToExcel(entries, filename) {
  const today   = new Date().toISOString().split('T')[0];
  const outFile = filename ?? `visitors_${today}.xlsx`;

  const HEADERS = [
    'Entry ID', 'Type', 'Name', 'Mobile / Emp ID',
    'Department', 'Status', 'Person to Meet',
    'Card(s)', 'Check-In', 'Check-Out', 'Reason for Visit',
  ];

  const rows = entries.map((e) => [
    e.id,
    e.type === 'EMPLOYEE' ? 'Employee' : 'Visitor',
    e.name,
    e.type === 'EMPLOYEE' ? (e.empId ?? '') : (e.mobile ?? ''),
    e.department ?? '',
    e.status === 'checked-in' ? 'Checked-in' : 'Checked-out',
    e.personToMeet ?? '',
    e.type === 'EMPLOYEE' ? 'N/A' : (e.card != null ? String(e.card) : ''),
    fmtDate(e.checkIn),
    fmtDate(e.checkOut),
    e.reasonForVisit ?? '',
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...rows]);

  ws['!cols'] = [
    { wch: 14 }, // Entry ID
    { wch: 10 }, // Type
    { wch: 22 }, // Name
    { wch: 16 }, // Mobile / Emp ID
    { wch: 18 }, // Department
    { wch: 14 }, // Status
    { wch: 22 }, // Person to Meet
    { wch: 10 }, // Card(s)
    { wch: 22 }, // Check-In
    { wch: 22 }, // Check-Out
    { wch: 30 }, // Reason
  ];
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  XLSX.utils.book_append_sheet(wb, ws, 'Visitor Log');
  XLSX.writeFile(wb, outFile);
}
