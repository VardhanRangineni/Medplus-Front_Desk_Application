package com.medplus.frontdesk_backend.security;

import com.medplus.frontdesk_backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * Central helper for resolving the caller's role and location from a JWT-backed
 * {@link Authentication} object.
 *
 * Role hierarchy:
 *   PRIMARY_ADMIN   → unrestricted access to all data across all locations.
 *   REGIONAL_ADMIN  → full page access but data scoped to their own location.
 *   RECEPTIONIST    → check-in / check-out + settings only, scoped to their location.
 */
@Component
@RequiredArgsConstructor
public class AuthorizationHelper {

    private final UserRepository userRepository;

    // ── Role resolution ───────────────────────────────────────────────────────

    public String getUserRole(Authentication auth) {
        return auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(a -> a.startsWith("ROLE_"))
                .map(a -> a.replace("ROLE_", ""))
                .findFirst()
                .orElse("");
    }

    public boolean isPrimaryAdmin(Authentication auth) {
        return "PRIMARY_ADMIN".equals(getUserRole(auth));
    }

    public boolean isRegionalAdmin(Authentication auth) {
        return "REGIONAL_ADMIN".equals(getUserRole(auth));
    }

    public boolean isReceptionist(Authentication auth) {
        return "RECEPTIONIST".equals(getUserRole(auth));
    }

    // ── Location resolution ───────────────────────────────────────────────────

    /**
     * Looks up the locationId assigned to the given employee in {@code usermanagement}.
     * Returns {@code null} if the employee has no usermanagement record.
     */
    public String getUserLocation(String employeeId) {
        return userRepository.findByEmployeeId(employeeId)
                .map(u -> u.getLocation())
                .orElse(null);
    }

    /**
     * Determines the effective location filter to apply for a given caller.
     *
     * <ul>
     *   <li>PRIMARY_ADMIN → uses the {@code requestedLocationId} param (may be {@code null} = all locations)</li>
     *   <li>REGIONAL_ADMIN → always their own location; {@code requestedLocationId} is ignored</li>
     *   <li>RECEPTIONIST   → always their own location; {@code requestedLocationId} is ignored</li>
     * </ul>
     */
    public String resolveEffectiveLocation(Authentication auth, String requestedLocationId) {
        if (isPrimaryAdmin(auth)) {
            return requestedLocationId;
        }
        return getUserLocation(auth.getName());
    }

    // ── Guard helper ──────────────────────────────────────────────────────────

    /**
     * Throws 403 if the caller is a RECEPTIONIST attempting to access a restricted resource.
     */
    public void denyReceptionist(Authentication auth) {
        if (isReceptionist(auth)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Access denied. Receptionists are not authorized to access this resource.");
        }
    }

    /**
     * For REGIONAL_ADMIN, asserts that the target locationId matches the caller's location.
     * Throws 403 if not. PRIMARY_ADMIN passes through unconditionally.
     */
    public void assertLocationAccess(Authentication auth, String targetLocationId) {
        if (isPrimaryAdmin(auth)) return;
        String callerLocation = getUserLocation(auth.getName());
        if (callerLocation == null || !callerLocation.equals(targetLocationId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Access denied. You can only manage data for your assigned location.");
        }
    }
}
