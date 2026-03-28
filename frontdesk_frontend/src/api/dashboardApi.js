// ─────────────────────────────────────────────────────────────────────────────
// dashboardApi.js
//
// All functions call the real REST backend (Spring Boot).
// USER-role endpoints auto-scope to the logged-in user's assigned location.
//
// Endpoint map (DashboardController.java):
//   GET /user/dashboard/locations               → getLocations()
//   GET /user/dashboard/overview?fromDate&toDate → getDashboardOverview()
//   GET /user/dashboard/kpis?fromDate&toDate     → getDashboardStats()
//   GET /user/dashboard/visitor-flow?fromDate&toDate → getVisitorFlowChart()
//   GET /user/dashboard/recent-visitors?limit&fromDate&toDate → getRecentVisitors()
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch } from './apiClient';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Converts a JS Date → ISO date string YYYY-MM-DD using LOCAL time.
 * Avoids toISOString() which converts to UTC and can shift the date
 * backwards by one day in timezones east of UTC (e.g. IST UTC+5:30).
 */
function toIsoDate(date) {
  if (!date) return undefined;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Formats a LocalDateTime string from the backend (e.g. "2026-03-27T08:05:00")
 * into a human-readable string like "Mar 27, 2026, 8:05 AM".
 */
function formatDateTime(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleString('en-US', {
    month:  'short',
    day:    'numeric',
    year:   'numeric',
    hour:   'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Maps a raw DashboardKpiDto from the backend to the shape DashboardHome uses.
 *   { checkIn: { All, Emp, 'Non Emp' }, checkOut: {...}, active: {...} }
 */
function mapKpis(kpi) {
  return {
    checkIn: {
      All:       kpi.checkInsAll,
      Emp:       kpi.checkInsEmployee,
      'Non Emp': kpi.checkInsNonEmployee,
    },
    checkOut: {
      All:       kpi.checkOutsAll,
      Emp:       kpi.checkOutsEmployee,
      'Non Emp': kpi.checkOutsNonEmployee,
    },
    active: {
      All:       kpi.activeInBuildingAll,
      Emp:       kpi.activeInBuildingEmployee,
      'Non Emp': kpi.activeInBuildingNonEmployee,
    },
  };
}

/**
 * Maps a raw DashboardFlowPointDto array to the { hour, count } shape
 * expected by the VisitorChart SVG component.
 * Backend field: label (e.g. "8am") → frontend field: hour.
 */
function mapFlowPoints(flow) {
  return flow.map(pt => ({ hour: pt.label, count: pt.count }));
}

/**
 * Maps a raw RecentVisitorDto to the table-row shape expected by
 * the recent-visitors table in DashboardHome.
 */
function mapRecentVisitor(v) {
  return {
    id:           v.visitorId,
    type:         v.visitorType === 'EMPLOYEE' ? 'Employee' : 'Visitor',
    name:         v.fullName,
    contactId:    v.identificationNumber,
    location:     v.locationName || v.locationId,
    status:       v.status === 'CheckedIn' ? 'Checked-in' : 'Checked-out',
    personToMeet: v.personToMeet || '—',
    cards:        v.cardNumber   || 'N/A',
    checkIn:      formatDateTime(v.checkInTime),
    checkOut:     formatDateTime(v.checkOutTime),   // null → '—' via formatDateTime
  };
}

// ── API functions ─────────────────────────────────────────────────────────────

/**
 * GET /user/dashboard/locations
 *
 * Fetch available locations for the Topbar filter dropdown.
 * Returns descriptive names as a plain string array to match the existing
 * Dashboard shell state (which stores a name string).
 *
 * @returns {Promise<string[]>}
 */
export async function getLocations() {
  const locations = await apiFetch('/user/dashboard/locations');
  return locations.map(l => l.descriptiveName);
}

/**
 * GET /user/dashboard/overview?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD
 *
 * Single-call overview that fetches KPIs + visitor-flow + recent visitors
 * in one round-trip.  This is the primary function used by DashboardHome.
 *
 * Backend response (DashboardOverviewDto):
 *   { appliedLocationId, appliedVisitorType, fromDate, toDate,
 *     kpis: DashboardKpiDto,
 *     visitorFlow: DashboardFlowPointDto[],
 *     recentVisitors: RecentVisitorDto[] }
 *
 * @param {{ dateFrom?: Date, dateTo?: Date }} params
 * @returns {Promise<{ stats, chartData, recentVisitors }>}
 */
export async function getDashboardOverview({ dateFrom, dateTo } = {}) {
  const params = new URLSearchParams();
  const from = toIsoDate(dateFrom || new Date());
  const to   = toIsoDate(dateTo   || new Date());
  params.set('fromDate', from);
  params.set('toDate',   to);

  const overview = await apiFetch(`/user/dashboard/overview?${params}`);

  return {
    stats:          mapKpis(overview.kpis),
    chartData:      mapFlowPoints(overview.visitorFlow),
    recentVisitors: overview.recentVisitors.map(mapRecentVisitor),
  };
}

// ── Individual endpoints (available for targeted use) ─────────────────────────

/**
 * GET /user/dashboard/kpis?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD
 *
 * Fetch only the three KPI cards.
 *
 * @param {{ dateFrom?: Date, dateTo?: Date }} params
 * @returns {Promise<{ checkIn, checkOut, active }>}
 */
export async function getDashboardStats({ dateFrom, dateTo } = {}) {
  const params = new URLSearchParams();
  const from = toIsoDate(dateFrom);
  const to   = toIsoDate(dateTo);
  if (from) params.set('fromDate', from);
  if (to)   params.set('toDate',   to);
  const query = params.toString() ? `?${params}` : '';

  const kpi = await apiFetch(`/user/dashboard/kpis${query}`);
  return mapKpis(kpi);
}

/**
 * GET /user/dashboard/visitor-flow?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD
 *
 * Fetch hourly visitor-flow data for the SVG area chart.
 * Pass the same date as both fromDate and toDate for a single-day chart.
 *
 * @param {{ date?: Date, dateFrom?: Date, dateTo?: Date }} params
 * @returns {Promise<Array<{ hour: string, count: number }>>}
 */
export async function getVisitorFlowChart({ date, dateFrom, dateTo } = {}) {
  const params = new URLSearchParams();
  const from = toIsoDate(dateFrom || date || new Date());
  const to   = toIsoDate(dateTo   || date || new Date());
  params.set('fromDate', from);
  params.set('toDate',   to);

  const flow = await apiFetch(`/user/dashboard/visitor-flow?${params}`);
  return mapFlowPoints(flow);
}

/**
 * GET /user/dashboard/recent-visitors?limit=N&fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD
 *
 * Fetch recent visitor / employee records for the dashboard table.
 *
 * @param {{ dateFrom?: Date, dateTo?: Date, limit?: number }} params
 * @returns {Promise<Array>}
 */
export async function getRecentVisitors({ dateFrom, dateTo, limit = 10 } = {}) {
  const params = new URLSearchParams({ limit });
  const from = toIsoDate(dateFrom || new Date());
  const to   = toIsoDate(dateTo   || new Date());
  params.set('fromDate', from);
  params.set('toDate',   to);

  const visitors = await apiFetch(`/user/dashboard/recent-visitors?${params}`);
  return visitors.map(mapRecentVisitor);
}
