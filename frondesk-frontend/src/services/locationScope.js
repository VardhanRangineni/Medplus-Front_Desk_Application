/** Legacy install codes → current location_master IDs. */
const LEGACY_LOCATION_ALIASES = {
  'HO-HO-HYD': 'MED-HO-00001',
};

export function resolveLocationId(locationId) {
  if (!locationId) return locationId;
  const key = String(locationId).trim().toUpperCase();
  return LEGACY_LOCATION_ALIASES[key] ?? String(locationId).trim();
}

/**
 * Builds location scope query params for read APIs.
 *
 * @param {string|null|undefined} locationId
 * @param {boolean} allLocations
 * @returns {URLSearchParams}
 */
export function buildLocationScopeParams(locationId, allLocations = false) {
  const params = new URLSearchParams();
  if (allLocations) {
    params.set('allLocations', 'true');
  } else if (locationId) {
    params.set('locationId', resolveLocationId(locationId));
  }
  return params;
}

/** All roles on the session (multi-role aware). */
export function getSessionRoles(session) {
  if (Array.isArray(session?.roles) && session.roles.length > 0) {
    return session.roles;
  }
  return session?.role ? [session.role] : [];
}

export function hasRole(session, role) {
  return getSessionRoles(session).includes(role);
}

export function hasAnyRole(session, roles) {
  const assigned = getSessionRoles(session);
  return roles.some((r) => assigned.includes(r));
}

/** Only users with Receptionist role may perform desk check-ins. */
export function canCheckIn(session) {
  return hasRole(session, 'RECEPTIONIST');
}

/** Assigned location IDs (supervisors may have several). */
export function getAssignedLocationIds(session) {
  if (Array.isArray(session?.locationIds) && session.locationIds.length > 0) {
    return session.locationIds.map((id) => String(id).trim()).filter(Boolean);
  }
  return session?.locationId ? [String(session.locationId).trim()] : [];
}

/**
 * Default location for primary admin header filter.
 */
export function defaultAdminLocationId(session) {
  // PRIMARY_ADMIN and DEPT_HEAD: no default location — see all sites
  if (hasRole(session, 'PRIMARY_ADMIN') || hasRole(session, 'DEPT_HEAD')) {
    return null;
  }
  const assigned = getAssignedLocationIds(session);
  return resolveLocationId(assigned[0] ?? session?.locationId ?? null);
}

/** Primary admin or supervisor — elevated nav / management screens. */
export function isAdminRole(session) {
  return hasAnyRole(session, ['PRIMARY_ADMIN', 'REGIONAL_ADMIN', 'DEPT_HEAD']);
}

/** Whether the session is a Department Head (view-only, no department scoping). */
export function isDeptHead(session) {
  return hasRole(session, 'DEPT_HEAD');
}

/** Primary admin or department head may switch across all sites. */
export function canFilterAllLocations(session) {
  return hasRole(session, 'PRIMARY_ADMIN') || hasRole(session, 'DEPT_HEAD');
}

/**
 * Show header location picker:
 * - primary admin: all sites
 * - supervisor / department head with 2+ assigned sites: only those sites
 */
export function canFilterLocations(session) {
  if (canFilterAllLocations(session)) return true;
  if (hasRole(session, 'REGIONAL_ADMIN') || hasRole(session, 'DEPT_HEAD')) {
    return getAssignedLocationIds(session).length > 1;
  }
  return false;
}

/**
 * Scope for read APIs.
 * Primary admin / Department Head → global filter (null = all locations).
 * Supervisor → one of assigned locations only.
 * Receptionist → session location.
 */
export function buildLocationScope(globalLocationId, session) {
  const resolvedId = globalLocationId ? resolveLocationId(globalLocationId) : null;
  if (canFilterAllLocations(session) || hasRole(session, 'DEPT_HEAD')) {
    return {
      locationId: resolvedId,
      allLocations: !resolvedId,
    };
  }
  if (hasRole(session, 'REGIONAL_ADMIN')) {
    const allowed = getAssignedLocationIds(session).map(resolveLocationId);
    const selected = resolvedId
      && allowed.some((id) => id.toLowerCase() === String(resolvedId).toLowerCase())
      ? resolvedId
      : resolveLocationId(allowed[0] ?? session?.locationId ?? null);
    return {
      locationId: selected,
      allLocations: false,
    };
  }
  return {
    locationId: resolveLocationId(session?.locationId ?? null),
    allLocations: false,
  };
}

/**
 * Whether session may edit/checkout this entry (mirrors backend assertCanMutateEntry).
 * Entry must already be checked-in for the action buttons; this only gates location.
 * DEPT_HEAD is view-only — never returns true for them.
 */
export function canActOnEntryLocation(session, entryLocationId) {
  // DEPT_HEAD is view-only
  if (hasRole(session, 'DEPT_HEAD')) return false;
  if (hasRole(session, 'PRIMARY_ADMIN')) return true;
  const entryLoc = resolveLocationId(entryLocationId);
  if (!entryLoc) return false;

  if (hasRole(session, 'REGIONAL_ADMIN')) {
    return getAssignedLocationIds(session)
      .map(resolveLocationId)
      .some((id) => id && id.toLowerCase() === String(entryLoc).toLowerCase());
  }

  // RECEPTIONIST is scoped to their session location
  const sessionLoc = resolveLocationId(session?.locationId);
  return Boolean(sessionLoc
    && String(sessionLoc).toLowerCase() === String(entryLoc).toLowerCase());
}
