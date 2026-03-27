// ─────────────────────────────────────────────────────────────────────────────
// locationApi.js
//
// All exported functions return mock data right now.
// When the backend is ready:
//   1. Delete the _MOCK_* constants
//   2. Uncomment the fetch blocks inside each function
//   3. Adjust the endpoint paths / response shapes to match the real API
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch } from './apiClient';

// ── Mock data (DELETE when backend APIs are available) ────────────────────────

const _MOCK_LOCATIONS = [
  {
    id: 'ED-HYD-RO',
    name: 'Corporate Office',
    type: 'Head Office',
    address: '8-2-293/82/A, Road No. 36',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500033',
    coordinates: '17.4295, 78.4479',
    status: 'Configured',
  },
  {
    id: 'HYD-SO',
    name: 'Software Office',
    type: 'Branch Office',
    address: 'Plot 12, HITEC City',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500081',
    coordinates: '17.4400, 78.3489',
    status: 'Configured',
  },
  {
    id: 'WAREHOUSE',
    name: 'Main Warehouse',
    type: 'Warehouse',
    address: 'Survey No. 214, Patancheru',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '502319',
    coordinates: '17.5250, 78.2628',
    status: 'Configured',
  },
  {
    id: 'HOSTEL',
    name: 'Company Hostel',
    type: 'Residential',
    address: '14-55, Begumpet',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500016',
    coordinates: '17.4434, 78.4704',
    status: 'Configured',
  },
];

// ── API functions ─────────────────────────────────────────────────────────────

/**
 * Fetch all master locations.
 * @returns {Promise<Array<LocationRecord>>}
 */
export async function getMasterLocations() {
  return Promise.resolve(_MOCK_LOCATIONS.map(l => ({ ...l })));

  // TODO: swap with real call
  // return apiFetch('/api/locations/master');
}

/**
 * Create a new master location.
 * @param {Omit<LocationRecord, 'id'>} payload
 * @returns {Promise<LocationRecord>}
 */
export async function createLocation(payload) {
  const newLocation = {
    ...payload,
    id: payload.id?.trim() || generateId(payload.name),
    status: payload.status || 'Configured',
  };
  return Promise.resolve({ ...newLocation });

  // TODO: swap with real call
  // return apiFetch('/api/locations/master', {
  //   method: 'POST',
  //   body: JSON.stringify(payload),
  // });
}

/**
 * Update an existing master location.
 * @param {string} id  Location ID
 * @param {Partial<LocationRecord>} payload
 * @returns {Promise<LocationRecord>}
 */
export async function updateLocation(id, payload) {
  return Promise.resolve({ id, ...payload });

  // TODO: swap with real call
  // return apiFetch(`/api/locations/master/${encodeURIComponent(id)}`, {
  //   method: 'PUT',
  //   body: JSON.stringify(payload),
  // });
}

/**
 * Delete a master location by ID.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteLocation(id) {
  return Promise.resolve();

  // TODO: swap with real call
  // return apiFetch(`/api/locations/master/${encodeURIComponent(id)}`, {
  //   method: 'DELETE',
  // });
}

/**
 * Upload an Excel / CSV file to bulk-create master locations.
 * The server should return an object with { created, errors }.
 *
 * @param {File} file
 * @returns {Promise<{ created: number, errors: string[] }>}
 */
export async function bulkUploadLocations(file) {
  return Promise.resolve({ created: 0, errors: [] });

  // TODO: swap with real call (multipart/form-data — do NOT set Content-Type manually)
  // const form = new FormData();
  // form.append('file', file);
  // return apiFetch('/api/locations/master/bulk-upload', {
  //   method: 'POST',
  //   headers: {},   // let browser set multipart boundary
  //   body: form,
  // });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * @typedef {{ id: string, name: string, type: string, address: string,
 *             city: string, state: string, pincode: string,
 *             coordinates: string, status: string }} LocationRecord
 */

/** Derives a short all-caps slug from a descriptive name if the user omits ID. */
function generateId(name = '') {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 12);
}
