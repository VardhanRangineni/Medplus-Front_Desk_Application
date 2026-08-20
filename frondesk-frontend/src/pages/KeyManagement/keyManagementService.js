/**
 * Key Management API — /api/key-management
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

/**
 * @param {{ page?: number, size?: number, filters?: { mobile?: string, displayName?: string } }} opts
 */
export async function getKeyManagementContacts({ page = 0, size = 20, filters = {} } = {}) {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (filters.mobile?.trim()) params.set('mobile', filters.mobile.trim());
  if (filters.displayName?.trim()) params.set('displayName', filters.displayName.trim());
  return request('GET', `/api/key-management/contacts?${params.toString()}`);
}

/**
 * @param {{ mobile: string, displayName?: string }} payload
 */
export async function addKeyManagementContact(payload) {
  return request('POST', '/api/key-management/contacts', payload);
}

/**
 * @param {number|string} id
 * @param {{ mobile: string, displayName?: string }} payload
 */
export async function updateKeyManagementContact(id, payload) {
  return request('PUT', `/api/key-management/contacts/${encodeURIComponent(id)}`, payload);
}

/**
 * @param {number|string} id
 */
export async function removeKeyManagementContact(id) {
  return request('DELETE', `/api/key-management/contacts/${encodeURIComponent(id)}`);
}

/**
 * Burns the old portal token and returns the contact with a new portalUrl.
 * @param {number|string} id
 */
export async function regenerateKeyManagementToken(id) {
  return request('POST', `/api/key-management/contacts/${encodeURIComponent(id)}/regenerate-token`);
}
