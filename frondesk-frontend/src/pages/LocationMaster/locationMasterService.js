/**
 * Location Master API — /api/location-master
 */

import { formatApiFailure } from '../../services/userFacingErrors';

async function request(method, path, body) {
  const result = await window.electronAPI.apiRequest(method, path, body ?? null);

  if (result.error || result.status === 0) {
    throw new ApiError(formatApiFailure(result), 0);
  }
  if (!result.ok) {
    throw new ApiError(formatApiFailure(result), result.status);
  }
  return result.body?.data;
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// ── Locations ────────────────────────────────────────────────────────────────

export async function getLocations({ page = 0, size = 20, filters = {} } = {}) {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (filters.locationId?.trim()) params.set('locationId', filters.locationId.trim());
  if (filters.locationName?.trim()) params.set('locationName', filters.locationName.trim());
  if (filters.status) params.set('status', filters.status);
  return request('GET', `/api/location-master/locations?${params.toString()}`);
}

export async function createLocation(payload) {
  return request('POST', '/api/location-master/locations', payload);
}

export async function updateLocationStatus(locationId, active) {
  return request('PATCH', `/api/location-master/locations/${encodeURIComponent(locationId)}/status`, { active });
}

export async function previewLocationId(companyId, locationTypeId) {
  const params = `companyId=${companyId}&locationTypeId=${locationTypeId}`;
  const data = await request('GET', `/api/location-master/locations/preview-id?${params}`);
  return data?.locationId ?? '';
}

// ── Companies ──────────────────────────────────────────────────────────────────

export async function getCompanies(activeOnly = false) {
  return request('GET', `/api/location-master/companies?activeOnly=${activeOnly}`);
}

export async function createCompany(payload) {
  return request('POST', '/api/location-master/companies', payload);
}

export async function updateCompanyStatus(id, active) {
  return request('PATCH', `/api/location-master/companies/${id}/status`, { active });
}

// ── Location types ─────────────────────────────────────────────────────────────

export async function getLocationTypes(activeOnly = false) {
  return request('GET', `/api/location-master/location-types?activeOnly=${activeOnly}`);
}

export async function createLocationType(payload) {
  return request('POST', '/api/location-master/location-types', payload);
}

export async function updateLocationTypeStatus(id, active) {
  return request('PATCH', `/api/location-master/location-types/${id}/status`, { active });
}

// ── States & cities ────────────────────────────────────────────────────────────

export async function getStates(activeOnly = true) {
  return request('GET', `/api/location-master/states?activeOnly=${activeOnly}`);
}

export async function createState(payload) {
  return request('POST', '/api/location-master/states', payload);
}

export async function getCities(stateCode, activeOnly = true) {
  const sc = stateCode ? `&stateCode=${encodeURIComponent(stateCode)}` : '';
  return request('GET', `/api/location-master/cities?activeOnly=${activeOnly}${sc}`);
}

export async function createCity(payload) {
  return request('POST', '/api/location-master/cities', payload);
}

// ── Devices (kiosks) ─────────────────────────────────────────────────────────

export async function getDevices({ page = 0, size = 20, filters = {} } = {}) {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (filters.locationId?.trim()) params.set('locationId', filters.locationId.trim());
  if (filters.displayName?.trim()) params.set('displayName', filters.displayName.trim());
  if (filters.status) params.set('status', filters.status);
  return request('GET', `/api/location-master/devices?${params.toString()}`);
}

export async function createDevice(payload) {
  return request('POST', '/api/location-master/devices', payload);
}

export async function updateDevice(deviceId, payload) {
  return request('PUT', `/api/location-master/devices/${encodeURIComponent(deviceId)}`, payload);
}

export async function updateDeviceStatus(deviceId, active) {
  return request('PATCH', `/api/location-master/devices/${encodeURIComponent(deviceId)}/status`, { active });
}

/** Resolve kiosk from current workstation MAC (authenticated). */
export async function resolveCurrentDevice() {
  return request('GET', '/api/location-master/devices/resolve');
}
