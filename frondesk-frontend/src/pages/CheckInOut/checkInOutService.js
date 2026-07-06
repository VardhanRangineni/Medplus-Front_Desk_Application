/**
 * checkInOutService.js
 *
 * All backend communication and data-export utilities for the Check-In / Check-Out screen.
 * Uses window.electronAPI.apiRequest() — token injected automatically by main process.
 *
 * Endpoints consumed:
 *   GET    /api/visitors?page=&size=&status=&department=&date=
 *   GET    /api/visitors/search?q=&page=&size=&status=&department=&date=
 *   PATCH  /api/visitors/:id/checkout
 *   GET    /api/visitors/:id
 *   PUT    /api/visitors/:id
 */

import { formatApiFailure } from '../../services/userFacingErrors';
import { buildLocationScopeParams } from '../../services/locationScope';

// ─── Types (JSDoc) ────────────────────────────────────────────────────────────

/**
 * @typedef {'VISITOR'|'EMPLOYEE'} EntryType
 * @typedef {'checked-in'|'checked-out'} EntryStatus
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
    throw new Error(formatApiFailure(result));
  }
  return result.body?.data ?? result.body;
}

/** Maps a raw API response entry to a UI-ready Entry (ISO strings → Date objects). */
function normalise(raw) {
  return {
    ...raw,
    checkIn:  raw.checkIn  ? new Date(raw.checkIn)  : null,
    checkOut: raw.checkOut ? new Date(raw.checkOut) : null,
    lastScan: raw.lastScanAt ? new Date(raw.lastScanAt) : null,
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
 * @param {Object}       [options]
 * @param {number}       [options.page=0]         0-based page index
 * @param {number}       [options.size=20]        Records per page
 * @param {string}       [options.search]         Full-text search query
 * @param {string}       [options.status]         "checked-in" | "checked-out" | null
 * @param {string}       [options.department]     Department filter
 * @param {string}       [options.from]           ISO date "YYYY-MM-DD" range start
 * @param {string}       [options.to]             ISO date "YYYY-MM-DD" range end
 * @param {string|null}  [options.locationId]     Admin-only location filter
 * @param {string|null}  [options.createdBy]      Filter entries by staff who checked in
 * @returns {Promise<EntriesPage>}
 */
export async function getEntries({
  page       = 0,
  size       = 20,
  search     = '',
  status     = null,
  department = null,
  from       = null,
  to         = null,
  locationId = null,
  allLocations = false,
  createdBy  = null,
} = {}) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('size', String(size));
  if (status)     params.set('status',     status);
  if (department) params.set('department', department);
  if (from)       params.set('from',       from);
  if (to)         params.set('to',         to);
  if (createdBy)  params.set('createdBy',  createdBy);
  buildLocationScopeParams(locationId, allLocations).forEach((v, k) => params.set(k, v));

  const trimmed = search.trim();
  const endpoint = trimmed
    ? `/api/visitors/search?q=${encodeURIComponent(trimmed)}&${params}`
    : `/api/visitors?${params}`;

  const data = await api('GET', endpoint);

  const content = Array.isArray(data?.content) ? data.content : [];
  return {
    entries:       content.map(normalise),
    totalElements: data?.totalElements ?? content.length,
    totalPages:    data?.totalPages    ?? 1,
    page:          data?.page          ?? page,
  };
}

/** Records per request when assembling a full export (table UI still uses 20). */
const EXPORT_FETCH_SIZE = 500;
/** Hard cap so a bug or huge dataset cannot hang the app indefinitely. */
const EXPORT_MAX_ROWS = 100_000;

/**
 * Loads every row matching the same filters as the Check-In/Out table, for Excel export.
 * Paginates until `totalElements` is reached or no more rows are returned.
 *
 * @param {Object}       [opts]  Same shape as {@link getEntries} (page/size ignored).
 * @returns {Promise<Entry[]>}
 */
export async function fetchAllEntriesForExport({
  search     = '',
  status     = null,
  department = null,
  from       = null,
  to         = null,
  locationId = null,
  allLocations = false,
  createdBy  = null,
} = {}) {
  const accumulated = [];
  let page = 0;

  while (accumulated.length < EXPORT_MAX_ROWS) {
    const { entries, totalElements } = await getEntries({
      page,
      size: EXPORT_FETCH_SIZE,
      search,
      status,
      department,
      from,
      to,
      locationId,
      allLocations,
      createdBy,
    });
    if (entries.length === 0) break;
    accumulated.push(...entries);
    if (accumulated.length >= totalElements) break;
    page += 1;
  }
  return accumulated;
}

/**
 * Returns aggregate counts by visit status.
 * Derived from three parallel getEntries calls (size=1) so the counts always
 * match the same date/location filters as the main table — no separate endpoint needed.
 *
 * @param {Object}      [opts]
 * @param {string}      [opts.from]        ISO date range start
 * @param {string}      [opts.to]          ISO date range end
 * @param {string|null} [opts.locationId]  Admin-only location filter
 * @param {string|null} [opts.createdBy]   Filter by staff who created entries
 * @returns {Promise<StatusCounts>}
 */
export async function getStatusCounts({ from, to, locationId, allLocations = false, createdBy } = {}) {
  const base = { page: 0, size: 1, from, to, locationId, allLocations, createdBy };
  const [allData, inData, outData] = await Promise.all([
    getEntries(base),
    getEntries({ ...base, status: 'checked-in'  }),
    getEntries({ ...base, status: 'checked-out' }),
  ]);
  return {
    total:      allData.totalElements,
    checkedIn:  inData.totalElements,
    checkedOut: outData.totalElements,
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
 * Fetches the ordered movement trail for a visitor entry.
 *
 * Endpoint: GET /api/visitors/:id/movement
 *
 * @param {string} id
 * @returns {Promise<Array<{ id: number, eventType: string, deviceName: string, locationName: string, floor: string|null, area: string|null, scannedAt: Date|null, scannedBy: string|null }>>}
 */
export async function getMovementTrail(id) {
  const data = await api('GET', `/api/visitors/${encodeURIComponent(id)}/movement`);
  const events = Array.isArray(data) ? data : [];
  return events.map((e) => ({
    ...e,
    scannedAt: e.scannedAt ? new Date(e.scannedAt) : null,
  }));
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
 * browser-style download inside Electron. Column order mirrors the on-screen table.
 *
 * @param {Entry[]} entries    - Rows to export (typically from {@link fetchAllEntriesForExport}).
 * @param {string}  [filename] - Defaults to "visitors_YYYY-MM-DD.xlsx".
 */
export async function exportToExcel(entries, filename) {
  const XLSX = await import('xlsx');
  const today   = new Date().toISOString().split('T')[0];
  const outFile = filename ?? `visitors_${today}.xlsx`;

  const HEADERS = [
    'Entry ID', 'Type', 'Name', 'Mobile / Emp ID',
    'Department', 'Status', 'Person to Meet',
    'Card(s)', 'Check-In', 'Check-Out', 'Last Scan Place', 'Last Scan Time', 'Reason for Visit',
  ];

  const rows = entries.map((e) => [
    e.id,
    e.type === 'EMPLOYEE' ? 'Employee' : 'Visitor',
    e.name,
    e.type === 'EMPLOYEE' ? (e.empId ?? '') : (e.mobile ?? ''),
    e.department ?? '',
    e.status === 'checked-in' ? 'Checked-in' : 'Checked-out',
    e.personToMeet ?? '',
    e.card != null ? String(e.card) : '',
    fmtDate(e.checkIn),
    fmtDate(e.checkOut),
    e.lastScanDeviceName ?? '',
    fmtDate(e.lastScan),
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
    { wch: 22 }, // Last Scan Place
    { wch: 22 }, // Last Scan Time
    { wch: 30 }, // Reason
  ];
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  XLSX.utils.book_append_sheet(wb, ws, 'Visitor Log');
  XLSX.writeFile(wb, outFile);
}

// ─── Pre-registration ─────────────────────────────────────────────────────────

/**
 * Creates a group pre-registration link for a given location.
 * Endpoint: POST /api/pre-register/link
 *
 * @param {string} locationId
 * @returns {Promise<{ groupToken, locationId, locationName, expiresAt }>}
 */
export async function createGroupLink(locationId) {
  const result = await window.electronAPI.apiRequest(
    'POST', '/api/pre-register/link', { locationId }
  );
  if (!result.ok) {
    const msg = result.body?.message || 'Failed to create group link.';
    throw new Error(msg);
  }
  return result.body?.data ?? result.body;
}

/**
 * Fetches visitor details for staff to review before accepting the check-in.
 * Endpoint: GET /api/pre-register/preview/:token
 *
 * @param {string} token
 * @returns {Promise<PreRegPreviewDto>}
 */
export async function getPreRegPreview(token) {
  const result = await window.electronAPI.apiRequest(
    'GET', `/api/pre-register/preview/${encodeURIComponent(token)}`
  );
  if (!result.ok) {
    const msg = result.body?.message || 'Failed to load visitor details.';
    throw new Error(msg);
  }
  return result.body?.data ?? result.body;
}

/**
 * Search employees at the location associated with a pre-registration token.
 * Endpoint: GET /api/pre-register/search-staff?q=...&token=...
 *
 * @param {string} query  Name, employee ID, or mobile
 * @param {string} token  Pre-registration token (used to determine location)
 * @returns {Promise<Array<{id, name, department}>>}
 */
export async function searchPreRegStaff(query, token) {
  const result = await window.electronAPI.apiRequest(
    'GET', `/api/pre-register/search-staff?q=${encodeURIComponent(query)}&token=${encodeURIComponent(token)}`
  );
  if (!result.ok) return [];
  return result.body?.data ?? [];
}

/**
 * Completes a check-in by scanning a visitor's pre-registration QR token.
 * Endpoint: POST /api/pre-register/checkin/:token
 *
 * @param {string} token  The raw token from the QR code (without "PREREG:" prefix)
 * @returns {Promise<object>}  The created visitor log entry
 */
export async function checkInByQr(token, resolvedPersonId, cardNumber = null) {
  const body = { resolvedPersonId };
  if (cardNumber != null && String(cardNumber).trim() !== '') {
    body.cardNumber = parseInt(String(cardNumber).trim(), 10);
  }
  const result = await window.electronAPI.apiRequest(
    'POST', `/api/pre-register/checkin/${encodeURIComponent(token)}`, body
  );
  if (!result.ok) {
    const msg = result.body?.message || 'QR check-in failed.';
    throw new Error(msg);
  }
  return result.body?.data ?? result.body;
}

/**
 * Records a zone movement scan for a checked-in visitor.
 * Endpoint: POST /api/visitors/scan
 *
 * @param {string} payload  Raw QR text (PREREG:token, VISITOR:MED-V-0001, or MED-V-0001)
 * @returns {Promise<object>}
 */
export async function recordZoneScan(payload) {
  const result = await window.electronAPI.apiRequest(
    'POST', '/api/visitors/scan', { payload }
  );
  if (!result.ok) {
    const msg = result.body?.message || 'Zone scan failed.';
    throw new Error(msg);
  }
  return result.body?.data ?? result.body;
}
