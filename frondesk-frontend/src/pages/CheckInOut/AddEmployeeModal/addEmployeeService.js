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

// ─── Re-export shared reference-data functions ────────────────────────────────
export { getPersonsToMeet, getDepartments } from '../AddVisitorModal/addVisitorService';

// ─── Private helper ───────────────────────────────────────────────────────────

async function api(method, path, body) {
  const result = await window.electronAPI.apiRequest(method, path, body);
  if (!result.ok) {
    const msg = result.body?.message || `Request failed: ${result.status}`;
    throw new Error(msg);
  }
  return result.body?.data ?? result.body;
}

// ─── Employee lookup ──────────────────────────────────────────────────────────

/**
 * Looks up an employee by their Employee ID.
 * Returns their name, department, and masked phone for the OTP hint.
 *
 * Endpoint: GET /api/visitors/employee-lookup/:empId
 *
 * @param {string} empId
 * @returns {Promise<{ found: boolean, employee?: object, message?: string }>}
 */
export async function lookupEmployee(empId) {
  const data = await api('GET', `/api/visitors/employee-lookup/${encodeURIComponent(empId)}`);
  return data;
}

// ─── OTP  (intentionally still mocked — SMS gateway not yet available) ────────

/**
 * TODO: OTP API — replace mock with:
 *   POST /api/otp/send  { empId }
 *   expects { success: boolean, message: string }
 */
export async function sendEmployeeOtp(empId) {
  await new Promise((r) => setTimeout(r, 700));
  console.log('[OTP] Sent to employee', empId);
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
 * Submits a new employee check-in entry.
 * Transforms the modal's form state into the shape expected by the backend.
 *
 * Endpoint: POST /api/visitors
 *
 * @param {object} data  Full payload assembled by AddEmployeeModal
 * @returns {Promise<{ success: boolean, entryId: string }>}
 */
export async function createEmployeeEntry(data) {
  const isGroup = data.visitType === 'group';

  const payload = {
    visitType:      data.visitType.toUpperCase(),         // individual → INDIVIDUAL
    entryType:      'EMPLOYEE',
    name:           data.name,
    mobile:         null,
    empId:          data.empId,
    personToMeetId: data.personToMeet,                    // employeeId
    cardNumber:     isGroup
                      ? (data.leadCardNumber ? parseInt(data.leadCardNumber, 10) : null)
                      : (data.cardNumber     ? parseInt(data.cardNumber,     10) : null),
    reasonForVisit: data.reasonForVisit || null,
    members: isGroup
      ? (data.members || []).map((m) => ({
          name:       m.name,
          cardNumber: m.card ? parseInt(m.card, 10) : null,
        }))
      : null,
  };

  const entry = await api('POST', '/api/visitors', payload);
  return { success: true, entryId: entry.id };
}
