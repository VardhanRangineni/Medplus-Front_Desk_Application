/**
 * dashboardService.js
 *
 * All backend communication for the Dashboard home screen.
 */

import { formatApiFailure } from '../../services/userFacingErrors';
import { buildLocationScopeParams } from '../../services/locationScope';

async function api(method, path, body) {
  const result = await window.electronAPI.apiRequest(method, path, body ?? null);
  if (!result.ok) {
    throw new Error(formatApiFailure(result));
  }
  return result.body?.data ?? result.body;
}

/**
 * @param {{ locationId?: string|null, allLocations?: boolean }} [scope]
 */
export async function getDashboardStats(scope = {}) {
  const params = buildLocationScopeParams(scope.locationId, scope.allLocations);
  const qs = params.toString();
  const data = await api('GET', `/api/dashboard/stats${qs ? `?${qs}` : ''}`);
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
 * @param {{ locationId?: string|null, allLocations?: boolean }} [scope]
 */
export async function getRecentVisitors(scope = {}) {
  const params = buildLocationScopeParams(scope.locationId, scope.allLocations);
  const qs = params.toString();
  const data = await api('GET', `/api/visitors/recent${qs ? `?${qs}` : ''}`);
  const entries = Array.isArray(data) ? data : [];
  return entries.map((raw) => ({
    ...raw,
    checkIn:  raw.checkIn  ? new Date(raw.checkIn)  : null,
    checkOut: raw.checkOut ? new Date(raw.checkOut) : null,
  }));
}
