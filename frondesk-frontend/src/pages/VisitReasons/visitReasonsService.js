/**
 * Visit Reasons API — /api/visit-reasons
 * Manages predefined visit reasons for visitors and employees.
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

// ── Visit Reasons ────────────────────────────────────────────────────────────

/** Maximum visit reasons allowed per type (VISITOR / EMPLOYEE) */
const MAX_REASONS_PER_TYPE = 10;

export { MAX_REASONS_PER_TYPE };

/**
 * Fetch paginated visit reasons filtered by type ('VISITOR' | 'EMPLOYEE').
 */
export async function getVisitReasons({ type, page = 0, size = 20, filters = {} } = {}) {
  const params = new URLSearchParams({ type, page: String(page), size: String(size) });
  if (filters.reasonName?.trim()) params.set('reasonName', filters.reasonName.trim());
  if (filters.status) params.set('status', filters.status);
  return request('GET', `/api/visit-reasons?${params.toString()}`);
}

/**
 * Fetch only active visit reasons for a given type (for dropdown consumption).
 */
export async function getActiveVisitReasons(type) {
  return request('GET', `/api/visit-reasons/active?type=${encodeURIComponent(type)}`);
}

/**
 * Create a new visit reason.
 */
export async function createVisitReason(payload) {
  return request('POST', '/api/visit-reasons', payload);
}

/**
 * Update an existing visit reason.
 */
export async function updateVisitReason(id, payload) {
  return request('PUT', `/api/visit-reasons/${encodeURIComponent(id)}`, payload);
}

/**
 * Toggle active/inactive status of a visit reason.
 */
export async function toggleVisitReasonStatus(id, active) {
  return request('PATCH', `/api/visit-reasons/${encodeURIComponent(id)}/status`, { active });
}

/**
 * Delete a visit reason.
 */
export async function deleteVisitReason(id) {
  return request('DELETE', `/api/visit-reasons/${encodeURIComponent(id)}`);
}
