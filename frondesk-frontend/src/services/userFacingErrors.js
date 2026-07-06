/**
 * Maps technical / API errors to short, user-friendly copy.
 * Never expose ports, stack traces, or dev instructions to end users.
 */

const CONNECTION_UNAVAILABLE =
  'We are unable to reach MedPlus services right now. Please check your connection and try again. If this continues, contact your administrator.';

const DESKTOP_APP_REQUIRED =
  'Please open MedPlus Visitor Management System (MVMS) from the desktop application on this workstation.';

const GENERIC_SIGN_IN_FAILED =
  'We could not sign you in. Please verify your Employee ID and password, then try again.';

const TECHNICAL_PATTERNS = [
  /port\s*\d+/i,
  /localhost/i,
  /127\.0\.0\.1/i,
  /econnrefused/i,
  /enotfound/i,
  /etimedout/i,
  /network error/i,
  /cannot reach/i,
  /fetch failed/i,
  /npm run/i,
  /backend/i,
  /exception/i,
  /stack trace/i,
  /status\s*0\b/i,
];

/**
 * @param {string} [message]
 * @returns {string|null} Sanitized message safe to show, or null if too technical
 */
export function sanitizeBackendMessage(message) {
  if (!message || typeof message !== 'string') return null;
  const trimmed = message.trim();
  if (!trimmed || trimmed.length > 200) return null;
  if (TECHNICAL_PATTERNS.some((re) => re.test(trimmed))) return null;
  return trimmed;
}

/**
 * @param {'connection'|'desktop'|'credentials'|'device'|'inactive'|'validation'|'generic'} kind
 * @param {string} [detail] Optional backend message (sanitized before use)
 */
export function getLoginErrorMessage(kind, detail) {
  switch (kind) {
    case 'connection':
      return CONNECTION_UNAVAILABLE;
    case 'desktop':
      return DESKTOP_APP_REQUIRED;
    case 'credentials':
      return 'The Employee ID or password you entered is incorrect. Please try again.';
    case 'device':
      return 'This workstation is not authorised for your account. Please contact your administrator.';
    case 'inactive':
      return 'Your account is not active. Please contact your administrator.';
    case 'validation':
      return detail || GENERIC_SIGN_IN_FAILED;
    case 'generic':
    default: {
      const safe = sanitizeBackendMessage(detail);
      return safe || GENERIC_SIGN_IN_FAILED;
    }
  }
}

/** For API services outside login (tables, modals, etc.) */
export function getConnectionErrorMessage() {
  return CONNECTION_UNAVAILABLE;
}

export function getGenericErrorMessage(detail) {
  const safe = sanitizeBackendMessage(detail);
  return safe || 'Something went wrong. Please try again or contact your administrator.';
}

/**
 * @param {{ error?: unknown, status?: number, body?: { message?: string } }} result
 */
export function formatApiFailure(result) {
  if (result?.error || result?.status === 0) {
    return getConnectionErrorMessage();
  }
  return getGenericErrorMessage(result?.body?.message);
}
