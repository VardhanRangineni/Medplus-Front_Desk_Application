// ─────────────────────────────────────────────────────────────────────────────
// dashboardApi.js
//
// All functions call the real REST backend.
// USER-role endpoints auto-scope to the logged-in user's assigned location.
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch } from './apiClient';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Converts a JS Date to an ISO date string (YYYY-MM-DD) for query params. */
function toIsoDate(date) {
  if (!date) return undefined;
  return date.toISOString().split('T')[0];
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

// ── API functions ─────────────────────────────────────────────────────────────

/**
 * Fetch available locations for the Topbar filter dropdown.
 * Returns location descriptive names as a plain string array so the existing
 * Dashboard shell state (which stores a name string) keeps working unchanged.
 *
 * @returns {Promise<string[]>}
 */
export async function getLocations() {
  const locations = await apiFetch('/user/dashboard/locations');
  return locations.map(l => l.descriptiveName);
}

/**
 * Fetch KPI counts (check-in, check-out, active in building) for the given
 * date range.  Location is derived server-side from the logged-in user profile.
 *
 * @param {{ dateFrom?: Date, dateTo?: Date }} params
 * @returns {Promise<{ checkIn: Record<string,number>, checkOut: Record<string,number>, active: Record<string,number> }>}
 */
export async function getDashboardStats({ dateFrom, dateTo } = {}) {
  const params = new URLSearchParams();
  const from = toIsoDate(dateFrom);
  const to   = toIsoDate(dateTo);
  if (from) params.set('fromDate', from);
  if (to)   params.set('toDate',   to);
  const query = params.toString() ? `?${params}` : '';

  const kpi = await apiFetch(`/user/dashboard/kpis${query}`);

  return {
    checkIn:  {
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
 * Fetch hourly visitor-flow data for the SVG area chart.
 * Scoped to a single day (fromDate = toDate = date param).
 * Location is derived server-side from the logged-in user profile.
 *
 * @param {{ date?: Date }} params
 * @returns {Promise<Array<{ hour: string, count: number }>>}
 */
export async function getVisitorFlowChart({ date } = {}) {
  const params = new URLSearchParams();
  const d = toIsoDate(date || new Date());
  params.set('fromDate', d);
  params.set('toDate',   d);

  const flow = await apiFetch(`/user/dashboard/visitor-flow?${params}`);
  return flow.map(pt => ({ hour: pt.label, count: pt.count }));
}

/**
 * Fetch recent visitor / employee records for the dashboard table.
 * Location is derived server-side from the logged-in user profile.
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

  return visitors.map(v => ({
    id:           v.visitorId,
    type:         v.visitorType === 'EMPLOYEE' ? 'Employee' : 'Visitor',
    name:         v.fullName,
    contactId:    v.identificationNumber,
    location:     v.locationName || v.locationId,
    status:       v.status === 'CheckedIn' ? 'Checked-in' : 'Checked-out',
    personToMeet: v.personToMeet || '—',
    cards:        v.cardNumber   || 'N/A',
    checkIn:      formatDateTime(v.checkInTime),
  }));
}
