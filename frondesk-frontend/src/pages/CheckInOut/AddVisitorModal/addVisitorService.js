/**
 * addVisitorService.js
 *
 * Backend communication for the Add Visitor modal.
 * All calls use window.electronAPI.apiRequest() — token injected by main process.
 *
 * OTP functions (sendOtp / verifyOtp) remain mocked until the SMS gateway is ready.
 * Search for "TODO: OTP API" to find them when the time comes.
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

// ─── OTP  (intentionally still mocked — SMS gateway not yet available) ────────

/**
 * TODO: OTP API — replace mock body with real SMS gateway call:
 *   POST /api/otp/send  { mobile }
 *   expects { success: boolean, message: string }
 */
export async function sendOtp(mobile) {
  await new Promise((r) => setTimeout(r, 900));
  console.log('[OTP] Sent to', mobile);
  return { success: true, message: 'OTP sent successfully.' };
}

/**
 * TODO: OTP API — replace mock body with:
 *   POST /api/otp/verify  { mobile, otp }
 *   expects { verified: boolean, message: string }
 */
export async function verifyOtp(mobile, otp) {
  await new Promise((r) => setTimeout(r, 900));
  if (otp.trim().length === 6) return { verified: true,  message: 'Mobile number verified.' };
  return { verified: false, message: 'Invalid OTP. Please enter the 6-digit code.' };
}

// ─── Reference data ───────────────────────────────────────────────────────────

/**
 * Fetches all locations from the local locationmaster.
 * Endpoint: GET /api/locations
 *
 * @returns {Promise<Array<{ id: string, name: string }>>}
 */
export async function getLocations() {
  const data = await api('GET', '/api/locations');
  return Array.isArray(data)
    ? data.map((l) => ({ id: l.code, name: l.name }))
    : [];
}

/**
 * Fetches all employees at the caller's location for the "Person to Meet" dropdown.
 * Endpoint: GET /api/visitors/persons-at-location
 *
 * @returns {Promise<Array<{ id: string, name: string, department: string }>>}
 */
export async function getPersonsToMeet() {
  const data = await api('GET', '/api/visitors/persons-at-location');
  return Array.isArray(data)
    ? data.map((p) => ({ id: p.id, name: p.name, department: p.department }))
    : [];
}

/**
 * Fetches distinct department names at the caller's location.
 * Endpoint: GET /api/visitors/departments  →  ["Operations", "HR", ...]
 *
 * Returns them in the { id, name } shape the modal's SelectField expects.
 *
 * @returns {Promise<Array<{ id: string, name: string }>>}
 */
export async function getDepartments() {
  const data = await api('GET', '/api/visitors/departments');
  return Array.isArray(data)
    ? data.map((name) => ({ id: name, name }))
    : [];
}

// ─── Visitor entry creation ───────────────────────────────────────────────────

/**
 * Submits a new visitor check-in entry.
 * Transforms the modal's form state into the shape expected by the backend.
 *
 * Endpoint: POST /api/visitors
 *
 * @param {object} visitorData  Full payload assembled by AddVisitorModal
 * @returns {Promise<{ success: boolean, entryId: string }>}
 */
export async function createVisitorEntry(visitorData) {
  const isGroup = visitorData.visitType === 'group';

  const payload = {
    visitType:      visitorData.visitType.toUpperCase(),   // individual → INDIVIDUAL
    entryType:      'VISITOR',
    name:           visitorData.fullName,
    mobile:         visitorData.mobile || null,
    empId:          null,
    personToMeetId: visitorData.personToMeet,              // employeeId
    cardNumber:     isGroup
                      ? (visitorData.leadCardNumber ? parseInt(visitorData.leadCardNumber, 10) : null)
                      : (visitorData.cardNumber     ? parseInt(visitorData.cardNumber,     10) : null),
    reasonForVisit: visitorData.reasonForVisit || null,
    members: isGroup
      ? (visitorData.members || []).map((m) => ({
          name:       m.name,
          cardNumber: m.card ? parseInt(m.card, 10) : null,
        }))
      : null,
  };

  const entry = await api('POST', '/api/visitors', payload);
  return { success: true, entryId: entry.id };
}
