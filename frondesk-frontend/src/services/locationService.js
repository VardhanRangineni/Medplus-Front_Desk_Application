/**
 * Shared location API helpers (dropdowns, user-management search).
 * Endpoint base: /api/locations
 */

import { formatApiFailure } from './userFacingErrors';

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

export async function getActiveLocations() {
  return request('GET', '/api/locations/active');
}

export async function searchLocations(q = '') {
  return request('GET', `/api/locations/search?q=${encodeURIComponent(q)}`);
}
