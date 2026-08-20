/**
 * addEmployeeService.js
 *
 * Backend communication for the Add Employee check-in modal.
 * Uses window.electronAPI.apiRequest() — token injected by main process.
 *
 * getPersonsToMeet and getDepartments are re-exported from addVisitorService
 * because they hit the same backend endpoints.
 *
 * OTP functions (sendEmployeeOtp / verifyEmployeeOtp) remain mocked.
 * Search for "TODO: OTP API" when the SMS gateway is ready.
 */

import { formatApiFailure } from '../../../services/userFacingErrors';

// ─── Re-export shared reference-data functions ────────────────────────────────
export { getPersonsToMeet, getDepartments } from '../AddVisitorModal/addVisitorService';

// ─── Private helper ───────────────────────────────────────────────────────────

async function api(method, path, body) {
  const result = await window.electronAPI.apiRequest(method, path, body);
  if (!result.ok) {
    throw new Error(formatApiFailure(result));
  }
  return result.body?.data ?? result.body;
}

// ─── HRMS employee lookup ─────────────────────────────────────────────────────

export {
  lookupHrmsByEmployeeId,
  lookupHrmsByHrmsId,
  lookupHrmsEmployee,
} from '../../../services/hrmsService';

// ─── OTP  (intentionally still mocked — SMS gateway not yet available) ────────

/**
 * TODO: OTP API — replace mock with:
 *   POST /api/otp/send  { empId }
 *   expects { success: boolean, message: string }
 */
export async function sendEmployeeOtp(empId) {
  await new Promise((r) => setTimeout(r, 700));
  return { success: true, message: 'OTP sent to registered phone number.' };
}

/**
 * TODO: OTP API — replace mock with:
 *   POST /api/otp/verify  { empId, otp }
 *   expects { verified: boolean, message: string }
 */
export async function verifyEmployeeOtp(empId, otp) {
  await new Promise((r) => setTimeout(r, 800));
  if (otp.trim().length === 6) return { verified: true,  message: 'Identity confirmed.' };
  return { verified: false, message: 'Invalid OTP. Please enter the 6-digit code.' };
}

// ─── Entry creation ───────────────────────────────────────────────────────────

/**
 * Updates an existing employee entry.
 * If a new photo was captured, uploads it first and includes the URL.
 *
 * Endpoint: PUT /api/visitors/:id
 *
 * @param {string} id
 * @param {object} data  Full payload assembled by AddEmployeeModal (edit mode)
 * @returns {Promise<{ success: boolean, entryId: string }>}
 */
export async function updateEmployeeEntry(id, data) {
  const payload = {
    entryType:        'EMPLOYEE',
    name:             data.name,
    empId:            data.empId,
    mobile:           data.mobile || null,
    personToMeetId:   data.personToMeet,
    cardNumber:       data.cardNumber ? parseInt(data.cardNumber, 10) : null,
    reasonForVisit:   data.reasonForVisit || null,
  };
  const entry = await api('PUT', `/api/visitors/${encodeURIComponent(id)}`, payload);
  return { success: true, entryId: entry.id ?? id };
}

/**
 * Submits a new employee check-in entry.
 * If a photo was captured, uploads it first and includes the URL in the payload.
 *
 * Endpoint: POST /api/visitors
 *
 * @param {object} data  Full payload assembled by AddEmployeeModal
 * @returns {Promise<{ success: boolean, entryId: string }>}
 */
export async function createEmployeeEntry(data) {
  const payload = {
    entryType:        'EMPLOYEE',
    visitType:        data.visitType || 'INDIVIDUAL',
    name:             data.name,
    mobile:           data.mobile || null,
    empId:            data.empId,
    personToMeetId:   data.personToMeet,
    reasonForVisit:   data.reasonForVisit || null,
  };

  const entry = await api('POST', '/api/visitors', payload);
  return { success: true, type: 'EMPLOYEE', entryId: entry.id, groupId: entry.groupId ?? null, ...entry };
}

/**
 * Creates a group employee check-in (MED-GROUP + MED-GV members).
 * Endpoint: POST /api/visitors/group
 */
export async function createGroupEmployeeEntries(groupData) {
  const payload = {
    entryType:      'EMPLOYEE',
    personToMeetId: groupData.personToMeet,
    reasonForVisit: groupData.reasonForVisit || null,
    members: (groupData.members || []).map((m) => ({
      name: m.name,
      empId: m.empId,
      mobile: m.mobile || null,
    })),
  };

  const result = await api('POST', '/api/visitors/group', payload);
  return {
    success: true,
    type: 'EMPLOYEE',
    groupId: result.groupId,
    members: result.members || [],
    entryId: result.members?.[0]?.id ?? null,
  };
}
