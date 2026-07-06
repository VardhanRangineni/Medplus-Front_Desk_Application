/**
 * accountService.js
 *
 * Self-service account operations available to any logged-in user
 * (independent of the User Management screen). Lives in the shared
 * services layer so shared components like AppHeader don't have to
 * reach into a page-specific service.
 *
 * Requests are routed through the Electron IPC bridge (window.electronAPI),
 * which injects the JWT Bearer token in the main process.
 */

import { formatApiFailure } from './userFacingErrors';

/**
 * Allows the currently logged-in user to change their own password.
 * The backend verifies the current password before applying the new one.
 *
 * Endpoint: POST /api/managed-users/me/change-password
 *
 * @param {string} currentPassword
 * @param {string} newPassword
 * @returns {Promise<void>}
 * @throws {Error} with a user-facing message on network/HTTP failure
 */
export async function changeOwnPassword(currentPassword, newPassword) {
  const result = await window.electronAPI.apiRequest(
    'POST',
    '/api/managed-users/me/change-password',
    { currentPassword, newPassword },
  );

  if (result.error || result.status === 0 || !result.ok) {
    throw new Error(formatApiFailure(result));
  }

  return result.body?.data;
}
