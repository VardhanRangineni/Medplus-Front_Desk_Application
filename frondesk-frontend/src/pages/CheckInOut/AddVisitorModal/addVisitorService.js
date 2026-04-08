/**
 * addVisitorService.js
 *
 * All API calls go through window.electronAPI.apiRequest() — the JWT token is
 * injected by the Electron main process automatically.
 *
 * ─── OTP functions ────────────────────────────────────────────────────────────
 * sendOtp / verifyOtp are intentionally MOCKED while the SMS gateway is under
 * development.  When the backend is ready, replace each function body with the
 * one-liner api() call shown in the TODO comment above it.  Everything else
 * (state management, UI flow) stays unchanged.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Private helper ───────────────────────────────────────────────────────────

async function api(method, path, body) {
  const result = await window.electronAPI.apiRequest(method, path, body);
  if (!result.ok) {
    if (result.status === 0) {
      throw new Error('Cannot reach the backend server. Please make sure it is running on localhost:8080.');
    }
    const msg = result.body?.message || `Request failed (HTTP ${result.status})`;
    throw new Error(msg);
  }
  return result.body?.data ?? result.body;
}

// ─── OTP  ─────────────────────────────────────────────────────────────────────
//
// Real API contract (implement on backend — see OtpController.java):
//
//   POST /api/otp/send
//   Authorization: Bearer <jwt>
//   Body:   { "mobile": "9876543210" }
//   200 OK: { "success": true,  "message": "OTP sent successfully." }
//   400:    { "success": false, "message": "<reason>" }
//
//   POST /api/otp/verify
//   Authorization: Bearer <jwt>
//   Body:   { "mobile": "9876543210", "otp": "483921" }
//   200 OK: { "verified": true,  "message": "Mobile number verified successfully." }
//   200 OK: { "verified": false, "message": "Invalid OTP. Please try again." }
//   410:    { "verified": false, "message": "OTP has expired. Please request a new OTP." }
//

/**
 * Sends an OTP to the visitor's mobile number.
 *
 * TODO: OTP API — when SMS gateway is live, replace the mock body with:
 *   return await api('POST', '/api/otp/send', { mobile });
 *
 * @param   {string} mobile  10-digit mobile number (digits only)
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function sendOtp(mobile) {
  // ── MOCK ─────────────────────────────────────────────────────────────────
  // Simulates network latency. The real SMS gateway call goes here.
  await new Promise((r) => setTimeout(r, 900));
  console.info('[OTP MOCK] OTP sent to', mobile, '— any 6-digit code will verify.');
  return { success: true, message: 'OTP sent successfully.' };
  // ─────────────────────────────────────────────────────────────────────────
}

/**
 * Verifies the OTP entered by the front-desk operator against the one sent
 * to the visitor's mobile.
 *
 * TODO: OTP API — when SMS gateway is live, replace the mock body with:
 *   return await api('POST', '/api/otp/verify', { mobile, otp });
 *
 * @param   {string} mobile  10-digit mobile number
 * @param   {string} otp     6-digit OTP string
 * @returns {Promise<{ verified: boolean, message: string }>}
 */
export async function verifyOtp(mobile, otp) {
  // ── MOCK ─────────────────────────────────────────────────────────────────
  // Any exactly-6-digit code is accepted.  The backend will validate the real
  // OTP against what was generated and stored server-side.
  await new Promise((r) => setTimeout(r, 900));
  if (otp.trim().length === 6) {
    return { verified: true,  message: 'Mobile number verified.' };
  }
  return { verified: false, message: 'Invalid OTP. Please enter the 6-digit code.' };
  // ─────────────────────────────────────────────────────────────────────────
}

// ─── Reference data ───────────────────────────────────────────────────────────

/**
 * Fetches all locations from the local location master.
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
    visitType:      'INDIVIDUAL',
    entryType:      'VISITOR',
    name:           visitorData.fullName,
    mobile:         visitorData.mobile || null,
    govtIdType:     visitorData.govtIdType   || null,
    govtIdNumber:   visitorData.govtIdNumber || null,
    personToMeetId: visitorData.personToMeet,
    cardNumber:     visitorData.cardNumber ? parseInt(visitorData.cardNumber, 10) : null,
    reasonForVisit: visitorData.reasonForVisit || null,
    members:        null,
  };
  const entry = await api('PUT', `/api/visitors/${encodeURIComponent(id)}`, payload);
  return { success: true, entryId: entry.id ?? id };
}

/**
 * Submits a new visitor check-in entry.
 * Endpoint: POST /api/visitors
 *
 * @param   {object} visitorData  Full payload assembled by AddVisitorModal
 * @returns {Promise<{ success: boolean, entryId: string, cardCode: string|null }>}
 */
export async function createVisitorEntry(visitorData) {
  const payload = {
    visitType:      'INDIVIDUAL',
    entryType:      'VISITOR',
    name:           visitorData.fullName,
    mobile:         visitorData.mobile || null,
    empId:          null,
    govtIdType:     visitorData.govtIdType   || null,
    govtIdNumber:   visitorData.govtIdNumber || null,
    personToMeetId: visitorData.personToMeet,
    cardNumber:     visitorData.cardNumber ? parseInt(visitorData.cardNumber, 10) : null,
    reasonForVisit: visitorData.reasonForVisit || null,
    members:        null,
  };

  const entry = await api('POST', '/api/visitors', payload);
  return { success: true, entryId: entry.id, cardCode: entry.cardCode ?? null, card: entry.card ?? null };
}
