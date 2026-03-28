// ─────────────────────────────────────────────────────────────────────────────
// locationApi.js  –  Location Master  (wired to real backend)
//
// Backend base: /admin/locations   (requires ADMIN role + JWT)
//
//  GET  /admin/locations                  → LocationPageDto
//  POST /admin/locations                  → LocationDto
//  PUT  /admin/locations/{locationId}     → LocationDto
//  POST /admin/locations/bulk-upload      → BulkUploadResultDto
//  GET  /admin/locations/download-report  → .xlsx blob
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch, BASE_URL, getAuthToken } from './apiClient';

// ── Field-mapping helpers ─────────────────────────────────────────────────────

/**
 * Backend LocationDto  →  frontend LocationRecord
 * Backend status values: CONFIGURED | NOTCONFIGURED
 * Frontend status labels: 'Configured' | 'Not Configured'
 */
function mapFromBackend(dto) {
  return {
    id:          dto.locationId,
    name:        dto.descriptiveName,
    type:        dto.type,
    address:     dto.address,
    city:        dto.city,
    state:       dto.state,
    pincode:     dto.pincode      || '',
    coordinates: dto.coordinates  || '',
    status:      dto.status === 'CONFIGURED' ? 'Configured' : 'Not Configured',
  };
}

/**
 * Frontend form data  →  CreateLocationDto / UpdateLocationDto
 */
function mapToDto(form) {
  return {
    descriptiveName: form.name.trim(),
    type:            form.type,
    coordinates:     form.coordinates?.trim() || null,
    address:         form.address.trim(),
    city:            form.city.trim(),
    state:           form.state.trim(),
    pincode:         form.pincode?.trim() || '',
    status:          form.status === 'Configured' ? 'CONFIGURED' : 'NOTCONFIGURED',
  };
}

// ── API functions ─────────────────────────────────────────────────────────────

/**
 * Fetch all master locations (up to 100 per page, page 0).
 * @returns {Promise<Array<LocationRecord>>}
 */
export async function getMasterLocations() {
  const page = await apiFetch('/admin/locations?pageSize=100&page=0');
  return page.rows.map(mapFromBackend);
}

/**
 * Create a new master location.
 * @param {object} payload  — frontend form shape
 * @returns {Promise<LocationRecord>}
 */
export async function createLocation(payload) {
  const saved = await apiFetch('/admin/locations', {
    method: 'POST',
    body:   JSON.stringify(mapToDto(payload)),
  });
  return mapFromBackend(saved);
}

/**
 * Update an existing master location.
 * @param {string} id  — locationId
 * @param {object} payload  — frontend form shape
 * @returns {Promise<LocationRecord>}
 */
export async function updateLocation(id, payload) {
  const updated = await apiFetch(`/admin/locations/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body:   JSON.stringify(mapToDto(payload)),
  });
  return mapFromBackend(updated);
}

/**
 * Delete a master location.
 * NOTE: The current backend does not expose a DELETE endpoint.
 * The UI performs an optimistic local removal; no server call is made.
 * @param {string} _id
 * @returns {Promise<void>}
 */
export async function deleteLocation(_id) {
  return Promise.resolve();
}

/**
 * Upload an .xlsx file to bulk-create master locations.
 * @param {File} file
 * @returns {Promise<{ totalRows: number, successCount: number, failedCount: number, errors: string[] }>}
 */
export async function bulkUploadLocations(file) {
  const formData = new FormData();
  formData.append('file', file);

  const token    = getAuthToken();
  const response = await fetch(`${BASE_URL}/admin/locations/bulk-upload`, {
    method:  'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // Do NOT set Content-Type — browser adds the multipart boundary automatically
    },
    body: formData,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || `Upload failed (${response.status})`);
  }

  return response.json();
}

/**
 * Download all current locations as an Excel report (.xlsx).
 * Triggers a browser file-save dialog.
 * @returns {Promise<void>}
 */
export async function downloadLocationReport() {
  const token    = getAuthToken();
  const response = await fetch(`${BASE_URL}/admin/locations/download-report`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`);
  }

  const blob = await response.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'locations_report.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Sync / refresh all master locations from the backend source of truth.
 * Call this when the user clicks "Fetch Locations".
 * Uses the same list endpoint — a fresh GET that returns the latest data.
 * @returns {Promise<Array<LocationRecord>>}
 */
export async function syncLocations() {
  const page = await apiFetch('/admin/locations?pageSize=100&page=0');
  return page.rows.map(mapFromBackend);

  // TODO: if the backend exposes a dedicated sync/import endpoint, swap to:
  // const page = await apiFetch('/admin/locations/sync', { method: 'POST' });
  // return page.rows.map(mapFromBackend);
}

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * @typedef {{
 *   id:          string,
 *   name:        string,
 *   type:        string,
 *   address:     string,
 *   city:        string,
 *   state:       string,
 *   pincode:     string,
 *   coordinates: string,
 *   status:      'Configured' | 'Not Configured'
 * }} LocationRecord
 */
