/**
 * reportsService.js
 *
 * All backend communication for the Reports page.
 * Uses window.electronAPI.apiRequest() — JWT token is injected
 * automatically by the Electron main process.
 *
 * Endpoints consumed:
 *   GET /api/reports/department-summary?from=YYYY-MM-DD&to=YYYY-MM-DD[&locationId=X]
 *   GET /api/reports/visitor-ratio?from=YYYY-MM-DD&to=YYYY-MM-DD[&locationId=X]
 *   GET /api/reports/avg-duration?from=YYYY-MM-DD&to=YYYY-MM-DD[&locationId=X]
 *   GET /api/reports/frequent-visitors?from=YYYY-MM-DD&to=YYYY-MM-DD&minVisits=N[&locationId=X]
 */

// ─── Private helper ───────────────────────────────────────────────────────────

async function api(path) {
  const result = await window.electronAPI.apiRequest('GET', path, null);
  if (!result.ok) {
    const msg = result.body?.message || `Request failed (HTTP ${result.status})`;
    throw new Error(msg);
  }
  return result.body?.data ?? result.body;
}

function buildParams(from, to, locationId) {
  const p = new URLSearchParams({ from, to });
  if (locationId) p.set('locationId', locationId);
  return p.toString();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Department-wise visit summary — drives the bar chart.
 *
 * @param {string} from        ISO date, e.g. "2026-03-01"
 * @param {string} to          ISO date, e.g. "2026-03-31"
 * @param {string|null} [locationId]  Admin-only location filter
 * @returns {Promise<Array<{ department: string, visitCount: number }>>}
 */
export async function getDeptSummary(from, to, locationId = null) {
  const data = await api(`/api/reports/department-summary?${buildParams(from, to, locationId)}`);
  return Array.isArray(data) ? data : [];
}

/**
 * Visitor vs Employee ratio — drives the donut chart.
 *
 * @param {string} from
 * @param {string} to
 * @param {string|null} [locationId]
 * @returns {Promise<{ visitorCount: number, employeeCount: number, totalCount: number }>}
 */
export async function getVisitorRatio(from, to, locationId = null) {
  const data = await api(`/api/reports/visitor-ratio?${buildParams(from, to, locationId)}`);
  return {
    visitorCount:  data?.visitorCount  ?? 0,
    employeeCount: data?.employeeCount ?? 0,
    totalCount:    data?.totalCount    ?? 0,
  };
}

/**
 * Average visit duration per department.
 *
 * @param {string} from
 * @param {string} to
 * @param {string|null} [locationId]
 * @returns {Promise<Array<{ department: string, avgDurationMinutes: number, visitCount: number }>>}
 */
export async function getAvgDuration(from, to, locationId = null) {
  const data = await api(`/api/reports/avg-duration?${buildParams(from, to, locationId)}`);
  return Array.isArray(data) ? data : [];
}

/**
 * Frequent visitor report — visitors with multiple check-ins.
 *
 * @param {string} from
 * @param {string} to
 * @param {number} [minVisits=2]
 * @param {string|null} [locationId]
 * @returns {Promise<Array<{
 *   name:       string,
 *   mobile:     string,
 *   visitCount: number,
 *   lastVisit:  string,
 *   departments: string,
 * }>>}
 */
export async function getFrequentVisitors(from, to, minVisits = 2, locationId = null) {
  const p = new URLSearchParams({ from, to, minVisits: String(minVisits) });
  if (locationId) p.set('locationId', locationId);
  const data = await api(`/api/reports/frequent-visitors?${p}`);
  return Array.isArray(data) ? data : [];
}
