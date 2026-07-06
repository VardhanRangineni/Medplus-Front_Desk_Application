/**
 * reportsService.js
 */

import { formatApiFailure } from '../../services/userFacingErrors';
import { buildLocationScopeParams } from '../../services/locationScope';

async function api(path) {
  const result = await window.electronAPI.apiRequest('GET', path, null);
  if (!result.ok) {
    throw new Error(formatApiFailure(result));
  }
  return result.body?.data ?? result.body;
}

function buildParams(from, to, locationId, allLocations = false) {
  const p = new URLSearchParams({ from, to });
  buildLocationScopeParams(locationId, allLocations).forEach((v, k) => p.set(k, v));
  return p.toString();
}

export async function getDeptSummary(from, to, locationId = null, allLocations = false) {
  const data = await api(`/api/reports/department-summary?${buildParams(from, to, locationId, allLocations)}`);
  return Array.isArray(data) ? data : [];
}

export async function getVisitorRatio(from, to, locationId = null, allLocations = false) {
  const data = await api(`/api/reports/visitor-ratio?${buildParams(from, to, locationId, allLocations)}`);
  return {
    visitorCount:  data?.visitorCount  ?? 0,
    employeeCount: data?.employeeCount ?? 0,
    totalCount:    data?.totalCount    ?? 0,
  };
}

export async function getAvgDuration(from, to, locationId = null, allLocations = false) {
  const data = await api(`/api/reports/avg-duration?${buildParams(from, to, locationId, allLocations)}`);
  return Array.isArray(data) ? data : [];
}

export async function getFrequentVisitors(from, to, minVisits = 2, locationId = null, allLocations = false) {
  const p = new URLSearchParams(buildParams(from, to, locationId, allLocations));
  p.set('minVisits', String(minVisits));
  const data = await api(`/api/reports/frequent-visitors?${p}`);
  return Array.isArray(data) ? data : [];
}

export async function getVisitTrend(from, to, locationId = null, allLocations = false) {
  const data = await api(`/api/reports/visit-trend?${buildParams(from, to, locationId, allLocations)}`);
  return Array.isArray(data) ? data : [];
}

export async function getActiveNow(locationId = null, allLocations = false) {
  const params = buildLocationScopeParams(locationId, allLocations);
  const qs = params.toString();
  const data = await api(`/api/reports/active-now${qs ? `?${qs}` : ''}`);
  return data?.activeCount ?? data?.count ?? 0;
}
