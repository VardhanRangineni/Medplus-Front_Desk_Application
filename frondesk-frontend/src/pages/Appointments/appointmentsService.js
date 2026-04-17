/**
 * appointmentsService.js
 *
 * All backend communication for the Appointments page.
 * Uses window.electronAPI.apiRequest() — token injected automatically by main process.
 *
 * Endpoints consumed:
 *   GET   /api/appointments?defaultView=true&page=&size=&from=&to=&locationId=
 *   GET   /api/appointments/search?q=&defaultView=false&page=&size=&from=&to=&locationId=
 *   GET   /api/appointments/:id/card-preview
 *   POST  /api/appointments/:id/checkin
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

/** Maps a raw API appointment to a UI-ready object. */
function normalise(raw) {
  return {
    ...raw,
    appointmentDate: raw.appointmentDate ? new Date(raw.appointmentDate) : null,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Appointment
 * @property {string}      id               - e.g. "APT-20260416-0001"
 * @property {string}      patientName
 * @property {string|null} mobile
 * @property {string|null} email
 * @property {string|null} personToMeet     - doctor / staff full name
 * @property {string|null} department
 * @property {Date|null}   appointmentDate  - date + time of the slot
 * @property {string|null} reason
 * @property {string|null} locationId
 * @property {string|null} locationName
 */

/**
 * Fetches one page of appointments.
 *
 * @param {Object}       [opts]
 * @param {boolean}      [opts.defaultView=true]  - when true, shows today from current time onwards
 * @param {number}       [opts.page=0]
 * @param {number}       [opts.size=20]
 * @param {string}       [opts.search='']
 * @param {string|null}  [opts.from]              - ISO date "YYYY-MM-DD" (overrides defaultView)
 * @param {string|null}  [opts.to]                - ISO date "YYYY-MM-DD"
 * @param {string|null}  [opts.locationId]
 * @returns {Promise<{ appointments: Appointment[], totalElements: number, totalPages: number, page: number }>}
 */
export async function getAppointments({
  defaultView = true,
  page        = 0,
  size        = 20,
  search      = '',
  from        = null,
  to          = null,
  locationId  = null,
} = {}) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('size', String(size));
  if (from)       params.set('from',       from);
  if (to)         params.set('to',         to);
  if (locationId) params.set('locationId', locationId);

  const trimmed = search.trim();
  let endpoint;

  if (trimmed) {
    params.set('defaultView', 'false');
    endpoint = `/api/appointments/search?q=${encodeURIComponent(trimmed)}&${params}`;
  } else {
    params.set('defaultView', String(defaultView));
    endpoint = `/api/appointments?${params}`;
  }

  const data = await api('GET', endpoint);

  const content = Array.isArray(data?.content) ? data.content : [];
  return {
    appointments:  content.map(normalise),
    totalElements: data?.totalElements ?? content.length,
    totalPages:    data?.totalPages    ?? 1,
    page:          data?.page          ?? page,
  };
}

/**
 * Fetches the check-in preview for an appointment.
 * Returns appointment details + next available card code WITHOUT assigning the card.
 *
 * Endpoint: GET /api/appointments/:id/card-preview
 *
 * @param {string} id - Appointment ID
 * @returns {Promise<{ appointment: Appointment, nextCardCode: string|null }>}
 */
export async function getCheckInPreview(id) {
  const data = await api('GET', `/api/appointments/${encodeURIComponent(id)}/card-preview`);
  return {
    appointment:  data.appointment ? normalise(data.appointment) : null,
    nextCardCode: data.nextCardCode ?? null,
  };
}

/**
 * Atomically checks in an appointment:
 *   - Assigns a card from cardmaster
 *   - Creates a visitor log entry (Status = CHECKED_IN)
 *   - Deletes the appointment from appointmentslog
 *
 * Endpoint: POST /api/appointments/:id/checkin
 *
 * @param {string} id - Appointment ID
 * @returns {Promise<Object>} VisitorResponseDto with id, name, cardCode, status, etc.
 */
export async function checkInAppointment(id) {
  return api('POST', `/api/appointments/${encodeURIComponent(id)}/checkin`);
}
