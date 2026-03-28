// ── Check-In / Check-Out API ───────────────────────────────────────────────────
// All functions call the real REST backend at /user/visitors (and /admin/locations).
// Auth is injected automatically by apiFetch via the stored JWT token.
// ──────────────────────────────────────────────────────────────────────────────

import { apiFetch } from './apiClient';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Returns today as YYYY-MM-DD using local time (avoids UTC shift from toISOString). */
function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Returns an ISO date string for a JS Date, local-time safe. */
function toIsoDate(date) {
  if (!date) return todayIso();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ── Field mapping helpers ──────────────────────────────────────────────────────

/**
 * Maps a backend VisitorDto → frontend Entry shape used by UI components.
 * Backend status values: CheckedIn / CheckedOut
 * Backend type values:   EMPLOYEE / NONEMPLOYEE
 */
function mapVisitor(v) {
  return {
    id:                  v.visitorId,
    type:                v.visitorType === 'EMPLOYEE' ? 'Employee' : 'Visitor',
    name:                v.fullName,
    mobileOrEmpId:       v.identificationNumber,
    status:              v.status === 'CheckedIn' ? 'Checked-in' : 'Checked-out',
    personToMeet:        v.personToMeet        || null,
    cards:               v.cardNumber          ? [v.cardNumber] : [],
    checkInTime:         v.checkInTime,
    checkOutTime:        v.checkOutTime        || null,
    location:            v.locationId,
    govtId:              v.govtId              || null,
    groupHeadVisitorId:  v.groupHeadVisitorId  || null,
    members:             [],
  };
}

/**
 * Takes a flat list of mapped entries and nests group members under their head.
 * Group members have a non-null groupHeadVisitorId pointing to the head's id.
 */
function nestGroupMembers(entries) {
  const heads   = entries.filter(e => !e.groupHeadVisitorId);
  const members = entries.filter(e =>  e.groupHeadVisitorId);
  return heads.map(head => ({
    ...head,
    members: members
      .filter(m => m.groupHeadVisitorId === head.id)
      .map(m => ({ ...m, type: 'Member' })),
  }));
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Fetch check-in entries for the given date range (defaults to today).
 * The backend caps pageSize at 100, so multiple pages are fetched in parallel
 * when more than 100 records exist for the window.
 *
 * @param {{ location?: string, from?: Date, to?: Date }} params
 * @returns {Promise<Entry[]>}
 */
export const getCheckInEntries = async ({ from, to } = {}) => {
  const fromDate = toIsoDate(from);
  const toDate   = toIsoDate(to);
  const base     = `/user/visitors?pageSize=100&page=0&fromDate=${fromDate}&toDate=${toDate}`;

  const first = await apiFetch(base);
  let rows = first.rows.map(mapVisitor);

  if (first.totalPages > 1) {
    // Fetch all remaining pages in parallel instead of sequentially.
    const pagePromises = [];
    for (let p = 1; p < first.totalPages; p++) {
      pagePromises.push(
        apiFetch(`/user/visitors?pageSize=100&page=${p}&fromDate=${fromDate}&toDate=${toDate}`)
          .then(r => r.rows.map(mapVisitor))
      );
    }
    const extraPages = await Promise.all(pagePromises);
    extraPages.forEach(page => { rows = rows.concat(page); });
  }

  return nestGroupMembers(rows);
};

/**
 * Fetch a single check-in entry by its visitorId.
 * Uses the search param on the list endpoint.
 *
 * @param {string} id  — visitor ID e.g. "MED-V-001"
 * @returns {Promise<Entry>}
 */
export const getEntryById = async (id) => {
  const page = await apiFetch(`/user/visitors?search=${encodeURIComponent(id)}&pageSize=1`);
  if (!page.rows.length) throw new Error(`Entry ${id} not found.`);
  return mapVisitor(page.rows[0]);
};

/**
 * Update editable fields of an existing visitor.
 * Requires visitorType and identificationNumber to be included in `updates`
 * (they are mandatory in the backend DTO but not collected in the edit form).
 *
 * @param {string} id
 * @param {object} updates — must include visitorType, identificationNumber, fullName,
 *                           locationId, personToMeet, cardNumber, govtIdNumber
 * @returns {Promise<Entry>}
 */
export const updateEntry = async (id, updates) => {
  const payload = {
    visitorType:          updates.visitorType          || 'NONEMPLOYEE',
    fullName:             updates.name                 || '',
    locationId:           updates.location             || updates.locationId || '',
    identificationNumber: updates.identificationNumber || '',
    govtId:               updates.govtIdNumber         || null,
    personToMeet:         updates.personToMeet         || null,
    cardNumber:           updates.cards?.[0]?.toString() || null,
  };
  const updated = await apiFetch(`/user/visitors/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body:   JSON.stringify(payload),
  });
  return mapVisitor(updated);
};

/**
 * Check out a visitor by ID.
 *
 * @param {string} id
 * @returns {Promise<{ id: string, status: 'Checked-out', checkOutTime: string }>}
 */
export const checkOutEntry = async (id) => {
  const updated = await apiFetch(`/user/visitors/${encodeURIComponent(id)}/checkout`, {
    method: 'POST',
  });
  return {
    id:           updated.visitorId,
    status:       'Checked-out',
    checkOutTime: updated.checkOutTime,
  };
};

/**
 * Check in a single visitor or employee.
 *
 * @param {{ visitorType, fullName, locationId, identificationNumber,
 *           govtId?, personToMeet?, cardNumber? }} payload
 * @returns {Promise<Entry>}
 */
export const checkInSingle = async (payload) => {
  const body = {
    visitorType:          payload.visitorType,
    fullName:             payload.fullName,
    locationId:           payload.locationId,
    identificationNumber: payload.identificationNumber,
    govtId:               payload.govtId       || null,
    personToMeet:         payload.personToMeet || null,
    cardNumber:           payload.cardNumber   || null,
  };
  const saved = await apiFetch('/user/visitors/check-in', {
    method: 'POST',
    body:   JSON.stringify(body),
  });
  return mapVisitor(saved);
};

/**
 * Check in a group (head + members).
 * Sub-visitors that have no individual mobile use the head's mobile as identificationNumber.
 *
 * @param {{ fullName, locationId, identificationNumber, govtId?,
 *           personToMeet?, cardNumber?,
 *           members: Array<{ name: string, cardNumber?: string }> }} payload
 * @returns {Promise<Entry>}  — head entry with members array nested inside
 */
export const checkInGroup = async (payload) => {
  const body = {
    head: {
      visitorType:          'NONEMPLOYEE',
      fullName:             payload.fullName,
      locationId:           payload.locationId,
      identificationNumber: payload.identificationNumber,
      govtId:               payload.govtId       || null,
      personToMeet:         payload.personToMeet || null,
      cardNumber:           payload.cardNumber   || null,
    },
    members: payload.members.map(m => ({
      visitorType:          'NONEMPLOYEE',
      fullName:             m.name,
      locationId:           payload.locationId,
      identificationNumber: payload.identificationNumber,
      govtId:               null,
      personToMeet:         payload.personToMeet || null,
      cardNumber:           m.cardNumber         || null,
    })),
  };
  const saved = await apiFetch('/user/visitors/group-check-in', {
    method: 'POST',
    body:   JSON.stringify(body),
  });
  const [head, ...memberList] = saved.map(mapVisitor);
  return {
    ...head,
    members: memberList.map(m => ({ ...m, type: 'Member' })),
  };
};

// ── Locations ──────────────────────────────────────────────────────────────────

/**
 * Get locations for form dropdowns.
 * Returns objects { id, name } so the dropdown can use the real locationId as value.
 *
 * @returns {Promise<Array<{ id: string, name: string }>>}
 */
export const getFormLocations = async () => {
  const locations = await apiFetch('/user/dashboard/locations');
  return locations.map(l => ({ id: l.locationId, name: l.descriptiveName }));
};

// ── Reference data (no dedicated backend endpoint yet) ─────────────────────────

/**
 * Get available departments for filter dropdowns.
 * @returns {Promise<string[]>}
 */
export const getDepartments = async () => {
  return ['HR', 'Finance', 'IT', 'Operations', 'Marketing'];
};

/**
 * Send an OTP to the registered contact of an employee.
 * @param {string} empId
 * @returns {Promise<{ success: boolean }>}
 */
export const sendEmployeeOtp = async (empId) => {
  return { success: true };
};

/**
 * Verify the OTP for an employee check-in.
 * Any 6-digit code is accepted until OTP backend is integrated.
 * @param {string} empId
 * @param {string} otp
 * @returns {Promise<{ success: boolean, verified: boolean }>}
 */
export const verifyEmployeeOtp = async (empId, otp) => {
  if (!otp || otp.length !== 6) throw new Error('Please enter the complete 6-digit OTP.');
  return { success: true, verified: true };
};

/**
 * Send an OTP to the given mobile number.
 * @param {string} mobile
 * @returns {Promise<{ success: boolean }>}
 */
export const sendOtp = async (mobile) => {
  return { success: true };
};

/**
 * Verify the OTP entered by the user.
 * Any 6-digit code is accepted until OTP backend is integrated.
 * @param {string} mobile
 * @param {string} otp
 * @returns {Promise<{ success: boolean, verified: boolean }>}
 */
export const verifyOtp = async (mobile, otp) => {
  if (!otp || otp.length !== 6) throw new Error('Please enter the complete 6-digit OTP.');
  return { success: true, verified: true };
};

/**
 * Get staff members who can be selected as "Person to Meet".
 * @returns {Promise<Array<{ id: string, name: string, department: string }>>}
 */
export const getStaffMembers = async () => {
  return [
    { id: 's-001', name: 'Sunita Reddy',  department: 'HR'         },
    { id: 's-002', name: 'Amit Sharma',   department: 'Finance'    },
    { id: 's-003', name: 'Priya Verma',   department: 'IT'         },
    { id: 's-004', name: 'Rajan Mehta',   department: 'Operations' },
    { id: 's-005', name: 'Deepa Nair',    department: 'Marketing'  },
  ];
};
