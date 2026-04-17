/**
 * appointmentApi.js — Production API layer
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  OTP ONLY IS MOCKED — everything else is a real backend call            ║
 * ║                                                                          ║
 * ║  Reason: the SMS gateway is not yet integrated.                          ║
 * ║  The two mock functions are clearly marked. When the gateway is ready:  ║
 * ║    1. Delete the mock block inside sendVisitorOtp / verifyVisitorOtp.   ║
 * ║    2. Delete the mock block inside verifyEmployeeOtp.                   ║
 * ║    3. That's it — zero other changes needed.                            ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Base URL is read from VITE_API_BASE_URL (optional).
 * During local dev the Vite proxy forwards /api → http://localhost:8080.
 */

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

// ── Axios instance ────────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: `${BASE_URL}/api/appointment/public`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

// Unwrap ApiResponse<T> → returns the inner `data` payload directly.
// On HTTP errors, throws with the backend's message string.
api.interceptors.response.use(
  (response) => response.data?.data ?? response.data,
  (error) => {
    const msg =
      error.response?.data?.message ??
      error.message ??
      'An unexpected error occurred. Please try again.';
    return Promise.reject(new Error(msg));
  }
);

// ── OTP mock helper ───────────────────────────────────────────────────────────

/**
 * Fixed OTP accepted during mock verification.
 * Remove this constant (and the mock blocks below) once the SMS gateway is live.
 */
const MOCK_OTP = '123456';

function mockDelay(ms = 700) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
//  1.  VISITOR OTP  —  *** MOCKED (no SMS gateway yet) ***
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simulates dispatching an OTP to the visitor's mobile number.
 *
 * ┌─ MOCK ──────────────────────────────────────────────────────────────────┐
 * │  Always succeeds immediately. No network call is made.                  │
 * │  The fixed test code is printed to the browser console.                 │
 * │  TO GO LIVE: delete the mock block and uncomment the api.post line.     │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * @param {string} mobile  10-digit Indian mobile number
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function sendVisitorOtp(mobile) {
  /* ── MOCK START ──────────────────────────────────────────────────────────── */
  await mockDelay();
  console.info(`%c[OTP] Test code for ${mobile}: ${MOCK_OTP}`, 'color:#d97706;font-weight:bold');
  return { success: true, message: 'OTP sent successfully.' };
  /* ── MOCK END ────────────────────────────────────────────────────────────── */

  // const result = await api.post('/otp/send', { mobile });
  // return result;
}

/**
 * Verifies the OTP entered by the visitor.
 *
 * ┌─ MOCK ──────────────────────────────────────────────────────────────────┐
 * │  Accepts only MOCK_OTP ("123456"). Any other value returns verified:false│
 * │  TO GO LIVE: delete the mock block and uncomment the api.post line.     │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * @param {string} mobile
 * @param {string} otp    6-digit code entered by user
 * @returns {Promise<{ verified: boolean, message: string }>}
 */
export async function verifyVisitorOtp(mobile, otp) {
  /* ── MOCK START ──────────────────────────────────────────────────────────── */
  await mockDelay();
  const ok = otp.trim() === MOCK_OTP;
  return {
    verified: ok,
    message: ok
      ? 'Mobile number verified successfully.'
      : `Incorrect OTP. (Test code: ${MOCK_OTP})`,
  };
  /* ── MOCK END ────────────────────────────────────────────────────────────── */

  // const result = await api.post('/otp/verify', { mobile, otp });
  // return result;
}

// ─────────────────────────────────────────────────────────────────────────────
//  2.  EMPLOYEE LOOKUP  —  REAL API CALL
//      The backend validates against usermanagement + usermaster tables.
//      The backend also "sends" OTP but currently only logs it to the server
//      console (SMS gateway TODO). Verification is mocked on the frontend.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Looks up an employee by ID in the usermanagement / usermaster tables.
 * Real backend call — returns employee name, department, masked phone.
 * The backend also dispatches an OTP to the employee's registered phone
 * (currently logged to server console until the SMS gateway is wired up).
 *
 * @param {string} empId
 * @returns {Promise<{ found: boolean, employee?: { id, name, department, maskedPhone } }>}
 */
export async function lookupEmployee(empId) {
  return await api.post('/employee/lookup', { empId });
}

/**
 * Verifies the employee OTP.
 *
 * ┌─ MOCK ──────────────────────────────────────────────────────────────────┐
 * │  Since the backend only logs the OTP (no SMS), verification is also     │
 * │  mocked on the frontend: accepts MOCK_OTP ("123456").                  │
 * │  TO GO LIVE: delete the mock block and uncomment the api.post line.     │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * @param {string} empId
 * @param {string} otp
 * @returns {Promise<{ verified: boolean, message: string }>}
 */
export async function verifyEmployeeOtp(empId, otp) {
  /* ── MOCK START ──────────────────────────────────────────────────────────── */
  await mockDelay();
  const ok = otp.trim() === MOCK_OTP;
  return {
    verified: ok,
    message: ok
      ? 'Employee verified successfully.'
      : `Incorrect OTP. (Test code: ${MOCK_OTP})`,
  };
  /* ── MOCK END ────────────────────────────────────────────────────────────── */

  // const result = await api.post('/employee/otp/verify', { empId, otp });
  // return result;
}

// ─────────────────────────────────────────────────────────────────────────────
//  3.  OFFICE LOCATIONS  —  REAL API CALL
//      GET /api/appointment/public/locations
//      → LocationRepository.findAllActive() → locationmaster table
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all active office locations for the "Office Location" dropdown.
 * Results are stable; callers may cache them for the session.
 *
 * @returns {Promise<Array<{ locationId, descriptiveName, city, state }>>}
 */
export async function getLocations() {
  return await api.get('/locations') ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
//  4.  EMPLOYEE SEARCH  —  REAL API CALL
//      (was section 3 before locations were added)
//      GET /api/appointment/public/employees?q=
//      → VisitorRepository.searchAllPersonsPublic() → usermaster table
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Type-ahead search for the "Person to Meet" autocomplete.
 * When {@code locationId} is provided, results are restricted to employees
 * whose work location matches that office.
 *
 * @param {string}  query       ≥ 2 characters
 * @param {string=} locationId  optional location filter
 * @returns {Promise<Array<{ id, name, department, designation }>>}
 */
export async function searchEmployees(query, locationId) {
  if (!query || query.trim().length < 2) return [];
  const params = { q: query.trim() };
  if (locationId) params.locationId = locationId;
  return await api.get('/employees', { params }) ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
//  4.  TIME SLOTS  —  REAL API CALL
//      GET /api/appointment/public/slots?date=&personId=
//      → AppointmentService.getAvailableSlots()
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns bookable time slots for a given date + host employee.
 *
 * @param {string} date      yyyy-MM-dd
 * @param {string} personId  employee ID of the person to meet
 * @returns {Promise<Array<{ time: string, value: string, available: boolean }>>}
 */
export async function getAvailableSlots(date, personId) {
  return await api.get('/slots', { params: { date, personId } }) ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
//  5.  BOOK APPOINTMENT  —  REAL API CALL
//      POST /api/appointment/public/book
//      → AppointmentService.bookAppointment()
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Submits the final appointment booking.
 *
 * @param {{
 *   entryType:       'VISITOR' | 'EMPLOYEE',
 *   name?:           string,
 *   mobile?:         string,
 *   empId?:          string,
 *   email?:          string,
 *   aadhaarNumber?:  string,
 *   personToMeetId:  string,
 *   reasonForVisit?: string,
 *   appointmentDate: string,   yyyy-MM-dd
 *   appointmentTime: string,   e.g. "10:00 AM"
 * }} bookingData
 *
 * @returns {Promise<AppointmentConfirmationDto>}
 */
export async function bookAppointment(bookingData) {
  return await api.post('/book', bookingData);
}

// ─────────────────────────────────────────────────────────────────────────────
//  6.  CONFIRMATION  —  REAL API CALL
//      GET /api/appointment/public/confirm/{token}
//      → AppointmentService.getConfirmation()
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retrieves a booking confirmation by its token.
 * Used to recover the confirmation screen on page refresh.
 *
 * @param {string} token  UUID returned by bookAppointment
 * @returns {Promise<AppointmentConfirmationDto>}
 */
export async function getConfirmation(token) {
  return await api.get(`/confirm/${token}`);
}

// Export the test OTP so UI components can show a dev hint
export { MOCK_OTP };
