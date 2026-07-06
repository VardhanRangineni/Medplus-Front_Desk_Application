package com.medplus.frontdesk_backend.security;

import com.medplus.frontdesk_backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Central helper for resolving the caller's roles and location from a JWT-backed
 * {@link Authentication} object.
 *
 * Users may hold multiple roles via {@code user_role_mapping}. The highest-privilege
 * role (Admin &gt; Supervisor &gt; Receptionist) is returned as the primary role.
 */
@Component
@RequiredArgsConstructor
public class AuthorizationHelper {

    private static final String ROLE_PREFIX = "ROLE_";

    private final UserRepository userRepository;

    // ── Role resolution ───────────────────────────────────────────────────────

    public Set<String> getUserRoles(Authentication auth) {
        if (auth == null) {
            return Set.of();
        }
        return auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(a -> a.startsWith(ROLE_PREFIX))
                .map(a -> a.substring(ROLE_PREFIX.length()))
                .collect(Collectors.toSet());
    }

    /** Primary role — first authority (admin roles are loaded before receptionist). */
    public String getUserRole(Authentication auth) {
        return getUserRoles(auth).stream().findFirst().orElse("");
    }

    public boolean hasRole(Authentication auth, String role) {
        return getUserRoles(auth).contains(role);
    }

    public boolean isPrimaryAdmin(Authentication auth) {
        return hasRole(auth, "PRIMARY_ADMIN");
    }

    public boolean isRegionalAdmin(Authentication auth) {
        return hasRole(auth, "REGIONAL_ADMIN");
    }

    public boolean isReceptionist(Authentication auth) {
        return hasRole(auth, "RECEPTIONIST");
    }

    public boolean hasElevatedRole(Authentication auth) {
        return isPrimaryAdmin(auth) || isRegionalAdmin(auth);
    }

    /**
     * Check-in / zone scan / visitor OTP require the Receptionist role.
     * Admins and supervisors without Receptionist may only monitor data.
     */
    public void requireCheckInPermission(Authentication auth) {
        if (!isReceptionist(auth)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Only users with the Receptionist role can perform check-ins. "
                            + "Ask your administrator to assign you the Receptionist role.");
        }
    }

    public void requireCheckInPermission() {
        requireCheckInPermission(SecurityContextHolder.getContext().getAuthentication());
    }

    // ── Location resolution ───────────────────────────────────────────────────

    public String getUserLocation(String employeeId) {
        return userRepository.findByEmployeeId(employeeId)
                .map(u -> u.getLocation())
                .orElse(null);
    }

    public String resolveEffectiveLocation(Authentication auth, String requestedLocationId) {
        if (isPrimaryAdmin(auth)) {
            return requestedLocationId;
        }
        return getUserLocation(auth.getName());
    }

    public void denyReceptionist(Authentication auth) {
        if (isReceptionist(auth) && !hasElevatedRole(auth)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Access denied. Receptionists are not authorized to access this resource.");
        }
    }

    public void assertLocationAccess(Authentication auth, String targetLocationId) {
        if (isPrimaryAdmin(auth)) return;
        String callerLocation = getUserLocation(auth.getName());
        if (callerLocation == null || !callerLocation.equals(targetLocationId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Access denied. You can only manage data for your assigned location.");
        }
    }

    public static int primaryRoleId(List<Integer> roleIds) {
        if (roleIds == null || roleIds.isEmpty()) {
            return 3;
        }
        return roleIds.stream().mapToInt(Integer::intValue).min().orElse(3);
    }
}
