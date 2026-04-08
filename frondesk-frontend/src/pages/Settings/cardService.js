/**
 * cardService.js
 *
 * All backend communication for the Card Master feature.
 *
 * Endpoints consumed:
 *   GET    /api/cards/stats           – stats per location
 *   GET    /api/cards                 – paginated card list
 *   PATCH  /api/cards/:id/restore     – restore a MISSING card
 *   GET    /api/cards/requests        – list requests
 *   POST   /api/cards/requests        – submit a new request
 *   PATCH  /api/cards/requests/:id/fulfill – fulfil request (admin)
 *   PATCH  /api/cards/requests/:id/cancel  – cancel request
 */

async function api(method, path, body) {
  const result = await window.electronAPI.apiRequest(method, path, body ?? null);
  if (!result.ok) {
    const msg = result.body?.message || `Request failed: ${result.status}`;
    throw new Error(msg);
  }
  return result.body?.data ?? result.body;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

/**
 * Returns card stats for one or all locations.
 * @param {string|null} locationId
 * @returns {Promise<Array<{locationId, locationName, total, available, assigned, missing}>>}
 */
export async function getCardStats(locationId) {
  const q = locationId ? `?locationId=${encodeURIComponent(locationId)}` : '';
  return api('GET', `/api/cards/stats${q}`);
}

// ── Card list ─────────────────────────────────────────────────────────────────

/**
 * Returns a paginated list of cards.
 * @param {{ locationId?, status?, page?, size? }} options
 */
export async function getCards({ locationId, status, page = 0, size = 50 } = {}) {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (locationId) params.set('locationId', locationId);
  if (status)     params.set('status',     status);
  return api('GET', `/api/cards?${params}`);
}

/**
 * Restores a MISSING card to AVAILABLE (admin only).
 * @param {number} cardId
 */
export async function restoreCard(cardId) {
  return api('PATCH', `/api/cards/${cardId}/restore`);
}

// ── Requests ──────────────────────────────────────────────────────────────────

/**
 * Returns card requests, optionally filtered.
 * @param {{ locationId?, status? }} options
 */
export async function getCardRequests({ locationId, status } = {}) {
  const params = new URLSearchParams();
  if (locationId) params.set('locationId', locationId);
  if (status)     params.set('status',     status);
  const q = params.toString() ? `?${params}` : '';
  return api('GET', `/api/cards/requests${q}`);
}

/**
 * Submits a new card request.
 * @param {{ locationId, requestType, quantity, notes? }} payload
 */
export async function submitCardRequest(payload) {
  return api('POST', '/api/cards/requests', payload);
}

/**
 * Fulfils a pending request (admin only) — creates new card records.
 * @param {number} requestId
 */
export async function fulfillCardRequest(requestId) {
  return api('PATCH', `/api/cards/requests/${requestId}/fulfill`);
}

/**
 * Cancels a pending request.
 * @param {number} requestId
 */
export async function cancelCardRequest(requestId) {
  return api('PATCH', `/api/cards/requests/${requestId}/cancel`);
}

/**
 * Returns the list of card codes belonging to a specific request batch.
 * Used to generate the download PDF.
 * @param {number} requestId
 * @returns {Promise<string[]>}  e.g. ["MSOH-VISITOR-1", "MSOH-VISITOR-2", ...]
 */
export async function getCardsForRequest(requestId) {
  return api('GET', `/api/cards/requests/${requestId}/cards`);
}

/**
 * Marks a fulfilled request's PDF as downloaded.
 * Call this after successfully saving the PDF to hide the download button.
 * @param {number} requestId
 */
export async function markRequestDownloaded(requestId) {
  return api('PATCH', `/api/cards/requests/${requestId}/mark-downloaded`);
}
