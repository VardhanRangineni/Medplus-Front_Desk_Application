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
    params.set('locationId', locationId);
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
  if (hasRole(session, 'PRIMARY_ADMIN')) {
    return session?.locationId ?? null;
  }
  const assigned = getAssignedLocationIds(session);
  return assigned[0] ?? session?.locationId ?? null;
}

/** Primary admin or supervisor — elevated nav / management screens. */
export function isAdminRole(session) {
  return hasAnyRole(session, ['PRIMARY_ADMIN', 'REGIONAL_ADMIN']);
}

/** Primary admin may switch across all sites. */
export function canFilterAllLocations(session) {
  return hasRole(session, 'PRIMARY_ADMIN');
}

/**
 * Show header location picker:
 * - primary admin: all sites
 * - supervisor with 2+ assigned sites: only those sites
 */
export function canFilterLocations(session) {
  if (canFilterAllLocations(session)) return true;
  return hasRole(session, 'REGIONAL_ADMIN') && getAssignedLocationIds(session).length > 1;
}

/**
 * Scope for read APIs.
 * Primary admin → global filter (null = all).
 * Supervisor → one of assigned locations only.
 * Receptionist → session location.
 */
export function buildLocationScope(globalLocationId, session) {
  if (canFilterAllLocations(session)) {
    return {
      locationId: globalLocationId,
      allLocations: !globalLocationId,
    };
  }
  if (hasRole(session, 'REGIONAL_ADMIN')) {
    const allowed = getAssignedLocationIds(session);
    const selected = globalLocationId
      && allowed.some((id) => id.toLowerCase() === String(globalLocationId).toLowerCase())
      ? globalLocationId
      : (allowed[0] ?? session?.locationId ?? null);
    return {
      locationId: selected,
      allLocations: false,
    };
  }
  return {
    locationId: session?.locationId ?? null,
    allLocations: false,
  };
}
