/**
 * dashboardService.js
 *
 * All backend communication for the Dashboard home screen.
 * Uses window.electronAPI.apiRequest() — JWT token injected automatically by main process.
 *
 * Endpoints consumed:
 *   GET /api/dashboard/stats   — today's aggregated statistics + hourly flow
 *   GET /api/visitors/recent   — 20 most recent check-in entries
 */

// ─── Private helper ───────────────────────────────────────────────────────────

async function api(method, path, body) {
  const result = await window.electronAPI.apiRequest(method, path, body ?? null);
  if (!result.ok) {
    const msg = result.body?.message || `Request failed: ${result.status}`;
    throw new Error(msg);
  }
  return result.body?.data ?? result.body;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetches today's aggregated dashboard statistics.
 *
 * Scope is determined server-side from the caller's role:
 *  - RECEPTIONIST            → their assigned location
 *  - PRIMARY / REGIONAL_ADMIN → all locations
 *
 * @returns {Promise<{
 *   todayCheckinsAll:       number,
 *   todayCheckinsEmp:       number,
 *   todayCheckinsNonEmp:    number,
 *   todayCheckoutsAll:      number,
 *   todayCheckoutsEmp:      number,
 *   todayCheckoutsNonEmp:   number,
 *   activeInBuildingAll:    number,
 *   activeInBuildingEmp:    number,
 *   activeInBuildingNonEmp: number,
 *   pendingSignouts:        number,
 *   visitorFlow:            Array<{ label: string, all: number, employee: number, nonEmployee: number }>
 * }>}
 */
export async function getDashboardStats() {
  const data = await api('GET', '/api/dashboard/stats');
  return {
    todayCheckinsAll:       data?.todayCheckinsAll       ?? 0,
    todayCheckinsEmp:       data?.todayCheckinsEmp       ?? 0,
    todayCheckinsNonEmp:    data?.todayCheckinsNonEmp    ?? 0,
    todayCheckoutsAll:      data?.todayCheckoutsAll      ?? 0,
    todayCheckoutsEmp:      data?.todayCheckoutsEmp      ?? 0,
    todayCheckoutsNonEmp:   data?.todayCheckoutsNonEmp   ?? 0,
    activeInBuildingAll:    data?.activeInBuildingAll    ?? 0,
    activeInBuildingEmp:    data?.activeInBuildingEmp    ?? 0,
    activeInBuildingNonEmp: data?.activeInBuildingNonEmp ?? 0,
    pendingSignouts:        data?.pendingSignouts        ?? 0,
    visitorFlow:            Array.isArray(data?.visitorFlow) ? data.visitorFlow : [],
  };
}

/**
 * Fetches the 20 most recent visitor/employee entries for the dashboard table.
 * ISO date strings on checkIn / checkOut are converted to Date objects.
 *
 * @returns {Promise<Array<{
 *   id:           string,
 *   type:         'VISITOR'|'EMPLOYEE',
 *   name:         string,
 *   mobile:       string|null,
 *   empId:        string|null,
 *   status:       'checked-in'|'checked-out',
 *   personToMeet: string|null,
 *   department:   string|null,
 *   locationId:   string|null,
 *   locationName: string|null,
 *   card:         number|null,
 *   checkIn:      Date|null,
 *   checkOut:     Date|null,
 * }>>}
 */
export async function getRecentVisitors() {
  const data = await api('GET', '/api/visitors/recent');
  const entries = Array.isArray(data) ? data : [];
  return entries.map((raw) => ({
    ...raw,
    checkIn:  raw.checkIn  ? new Date(raw.checkIn)  : null,
    checkOut: raw.checkOut ? new Date(raw.checkOut) : null,
  }));
}
