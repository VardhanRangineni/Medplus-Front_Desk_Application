/**
 * addVisitorService.js
 *
 * All API calls go through window.electronAPI.apiRequest() — the JWT token is
 * injected by the Electron main process automatically.
 */

import { formatApiFailure } from '../../../services/userFacingErrors';

// ─── Private helper ───────────────────────────────────────────────────────────

async function api(method, path, body) {
  const result = await window.electronAPI.apiRequest(method, path, body);
  if (!result.ok) {
    throw new Error(formatApiFailure(result));
  }
  return result.body?.data ?? result.body;
}

// ─── OTP  ─────────────────────────────────────────────────────────────────────

/**
 * Sends an OTP to the visitor's mobile via MVMS backend (POST /api/otp/send).
 * SMS is dispatched server-side — not from the desktop app.
 *
 * @param   {string} mobile  10-digit mobile number (digits only)
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function sendOtp(mobile) {
  return await api('POST', '/api/otp/send', { mobile });
}

/**
 * Verifies OTP via MVMS backend (POST /api/otp/verify).
 *
 * @param   {string} mobile  10-digit mobile number
 * @param   {string} otp     5-digit OTP string
 * @returns {Promise<{ verified: boolean, message: string }>}
 */
export async function verifyOtp(mobile, otp) {
  return await api('POST', '/api/otp/verify', { mobile, otp });
}

// ─── Reference data ───────────────────────────────────────────────────────────

/**
 * Fetches active locations for dropdowns.
 * Endpoint: GET /api/locations/active
 *
 * @returns {Promise<Array<{ id: string, name: string }>>}
 */
export async function getLocations() {
  const data = await api('GET', '/api/locations/active');
  return Array.isArray(data)
    ? data.map((l) => ({ id: l.code, name: l.name }))
    : [];
}

/**
 * Fetches all employees at the caller's location for the "Person to Meet" dropdown.
 * Endpoint: GET /api/visitors/persons-at-location
 *
 * @returns {Promise<Array<{ id: string, name: string, department: string, phone: string }>>}
 */
export async function getPersonsToMeet() {
  const data = await api('GET', '/api/visitors/persons-at-location');
  return Array.isArray(data)
    ? data.map((p) => ({
        id: p.id,
        name: p.name,
        department: p.department,
        phone: p.phone ?? '',
      }))
    : [];
}

/**
 * Fetches distinct department names at the caller's location.
 * Endpoint: GET /api/visitors/departments  →  ["Operations", "HR", ...]
 *
 * Returns them in the { id, name } shape that SelectField expects.
 *
 * @returns {Promise<Array<{ id: string, name: string }>>}
 */
export async function getDepartments() {
  const data = await api('GET', '/api/visitors/departments');
  return Array.isArray(data)
    ? data.map((name) => ({ id: name, name }))
    : [];
}

/**
 * Looks up person-to-meet by mobile via HRMS + local location check.
 * Endpoint: GET /api/visitors/person-by-mobile?mobile=
 *
 * @param   {string} mobile  10-digit mobile number
 * @returns {Promise<{ id: string, name: string, department: string, phone: string }>}
 */
export async function lookupPersonToMeetByMobile(mobile) {
  const digits = String(mobile || '').replace(/\D/g, '');
  const data = await api('GET', `/api/visitors/person-by-mobile?mobile=${encodeURIComponent(digits)}`);
  return {
    id: data.id,
    name: data.name,
    department: data.department ?? '',
    phone: data.phone ?? digits,
  };
}

// ─── Visitor entry CRUD ───────────────────────────────────────────────────────

/**
 * Updates an existing visitor entry.
 * Endpoint: PUT /api/visitors/:id
 *
 * @param   {string} id
 * @param   {object} visitorData  Full payload assembled by AddVisitorModal (edit mode)
 * @returns {Promise<{ success: boolean, entryId: string }>}
 */
export async function updateVisitorEntry(id, visitorData) {
  const payload = {
    entryType:        'VISITOR',
    name:             visitorData.fullName,
    mobile:           visitorData.mobile || null,
    govtIdType:       visitorData.govtIdType   || null,
    govtIdNumber:     visitorData.govtIdNumber || null,
    personToMeetId:   visitorData.personToMeet,
    cardNumber:       visitorData.cardNumber ? parseInt(visitorData.cardNumber, 10) : null,
    reasonForVisit:   visitorData.reasonForVisit || null,
    companyName:      visitorData.companyName  || null,
  };
  const entry = await api('PUT', `/api/visitors/${encodeURIComponent(id)}`, payload);
  return { success: true, entryId: entry.id ?? id };
}

/**
 * Submits a new visitor check-in entry.
 * Endpoint: POST /api/visitors
 *
 * @param   {object} visitorData  Full payload assembled by AddVisitorModal
 * @returns {Promise<{ success: boolean, entryId: string, card: number|null }>}
 */
export async function createVisitorEntry(visitorData) {
  const payload = {
    entryType:        'VISITOR',
    name:             visitorData.fullName,
    mobile:           visitorData.mobile || null,
    empId:            null,
    govtIdType:       visitorData.govtIdType   || null,
    govtIdNumber:     visitorData.govtIdNumber || null,
    personToMeetId:   visitorData.personToMeet,
    cardNumber:       visitorData.cardNumber ? parseInt(visitorData.cardNumber, 10) : null,
    reasonForVisit:   visitorData.reasonForVisit || null,
    companyName:      visitorData.companyName  || null,
  };

  const entry = await api('POST', '/api/visitors', payload);
  return {
    success: true,
    type: 'VISITOR',
    entryId: entry.id,
    card: entry.card ?? null,
    visitPassSmsStatus: entry.visitPassSmsStatus ?? null,
    visitPassMessage: entry.visitPassMessage ?? null,
  };
}

export async function resendVisitPass(visitorId) {
  return await api('POST', `/api/visitors/${encodeURIComponent(visitorId)}/resend-visit-pass`, {});
}
