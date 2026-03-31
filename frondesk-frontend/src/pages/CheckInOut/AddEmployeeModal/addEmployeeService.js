/**
 * addEmployeeService.js
 *
 * Employee check-in flow services.
 * Search for "TODO: OTP API" and "TODO: ATTACH API" to wire real endpoints.
 *
 * getPersonsToMeet and getDepartments are re-exported from the visitor
 * service — they hit the same backend endpoints, so no duplication needed.
 */

// ─── Re-export shared reference-data functions ────────────────────────────────
export { getPersonsToMeet, getDepartments } from '../AddVisitorModal/addVisitorService';

// ─── Internal helper ──────────────────────────────────────────────────────────
function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Employee lookup ──────────────────────────────────────────────────────────

/**
 * Look up an employee by their Employee ID.
 * Returns their name, department, and a masked phone number so the
 * user can confirm OTP is going to the right number.
 *
 * TODO: ATTACH API — replace mock body with:
 *   const res = await fetch(`/api/employees/${encodeURIComponent(empId)}`);
 *   if (res.status === 404) return { found: false, message: 'Employee not found.' };
 *   return { found: true, employee: await res.json() };
 *   // employee shape: { id, name, department, maskedPhone }
 *
 * @param {string} empId
 * @returns {Promise<{ found: boolean, employee?: object, message?: string }>}
 */
export async function lookupEmployee(empId) {
  // ── MOCK START ──
  await delay(700);
  const DB = {
    EMP1001: { id: 'EMP1001', name: 'Ravi Kumar',   department: 'Operations', maskedPhone: '98****10' },
    EMP1002: { id: 'EMP1002', name: 'Priya Verma',  department: 'HR',         maskedPhone: '98****55' },
    EMP1003: { id: 'EMP1003', name: 'Amit Sharma',  department: 'IT',         maskedPhone: '97****21' },
    EMP1004: { id: 'EMP1004', name: 'Sunita Reddy', department: 'Finance',    maskedPhone: '99****78' },
    EMP1005: { id: 'EMP1005', name: 'Kiran Reddy',  department: 'Security',   maskedPhone: '90****45' },
  };
  const emp = DB[empId.trim().toUpperCase()];
  if (emp) return { found: true, employee: emp };
  return { found: false, message: 'Employee ID not found. Please check and try again.' };
  // ── MOCK END ──
}

// ─── OTP ──────────────────────────────────────────────────────────────────────

/**
 * Send an OTP to the employee's registered phone number.
 *
 * TODO: OTP API — replace mock body with:
 *   const res = await fetch('/api/otp/send', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ empId }),
 *   });
 *   return res.json(); // { success: boolean, message: string }
 *
 * @param {string} empId
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function sendEmployeeOtp(empId) {
  // ── MOCK START ──
  await delay(700);
  console.log('[OTP] Sent to employee', empId);
  return { success: true, message: 'OTP sent to registered phone number.' };
  // ── MOCK END ──
}

/**
 * Verify the OTP entered by the employee.
 *
 * TODO: OTP API — replace mock body with:
 *   const res = await fetch('/api/otp/verify', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ empId, otp }),
 *   });
 *   return res.json(); // { verified: boolean, message: string }
 *
 * @param {string} empId
 * @param {string} otp    6-digit code
 * @returns {Promise<{ verified: boolean, message: string }>}
 */
export async function verifyEmployeeOtp(empId, otp) {
  // ── MOCK START ── (accepts any 6-digit code)
  await delay(800);
  if (otp.trim().length === 6) {
    return { verified: true, message: 'Identity confirmed.' };
  }
  return { verified: false, message: 'Invalid OTP. Please enter the 6-digit code.' };
  // ── MOCK END ──
}

// ─── Entry creation ───────────────────────────────────────────────────────────

/**
 * Submit a new employee check-in entry.
 *
 * TODO: ATTACH API — replace mock body with:
 *   const res = await fetch('/api/entries', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify(data),
 *   });
 *   return res.json(); // { success: boolean, entryId: string }
 *
 * @param {object} data  Full payload assembled by AddEmployeeModal
 * @returns {Promise<{ success: boolean, entryId: string }>}
 */
export async function createEmployeeEntry(data) {
  // ── MOCK START ──
  await delay(1200);
  console.log('[Employee] Creating entry:', data);
  return { success: true, entryId: `EMP-CHK-${Date.now()}` };
  // ── MOCK END ──
}
