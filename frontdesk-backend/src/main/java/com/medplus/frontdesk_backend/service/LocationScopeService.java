package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;

/**
 * Resolves which {@code locationId} read APIs should filter on.
 *
 * <ul>
 *   <li>Primary admin with {@code allLocations=true} → {@code null} (no filter).</li>
 *   <li>Primary admin with explicit {@code locationId} → that location.</li>
 *   <li>Supervisor → only among assigned locations (never all sites).</li>
 *   <li>Receptionist → operational kiosk location.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class LocationScopeService {

    private final OperationalLocationService operationalLocationService;
    private final UserRepository userRepository;

    /**
     * @return {@code null} when data should span all locations.
     */
    public String resolveReadScope(String callerEmployeeId,
                                   String workstationMac,
                                   Authentication auth,
                                   String locationIdParam,
                                   Boolean allLocations) {
        if (isPrimaryAdmin(auth)) {
            if (Boolean.TRUE.equals(allLocations)) {
                return null;
            }
            if (StringUtils.hasText(locationIdParam)) {
                return locationIdParam.trim();
            }
            return operationalLocationService.resolveForUser(callerEmployeeId, workstationMac);
        }

        if (isRegionalAdmin(auth)) {
            List<String> allowed = userRepository.findLocationIdsByEmployeeId(callerEmployeeId);
            if (StringUtils.hasText(locationIdParam)) {
                String requested = locationIdParam.trim();
                boolean ok = allowed.stream().anyMatch(id -> id.equalsIgnoreCase(requested));
                if (ok) {
                    return requested;
                }
            }
            if (!allowed.isEmpty()) {
                return allowed.get(0);
            }
            return operationalLocationService.resolveForUser(callerEmployeeId, workstationMac);
        }

        return operationalLocationService.resolveForUser(callerEmployeeId, workstationMac);
    }

    private static boolean isPrimaryAdmin(Authentication auth) {
        return hasAuthority(auth, "ROLE_PRIMARY_ADMIN");
    }

    private static boolean isRegionalAdmin(Authentication auth) {
        return hasAuthority(auth, "ROLE_REGIONAL_ADMIN");
    }

    private static boolean hasAuthority(Authentication auth, String authority) {
        if (auth == null) {
            return false;
        }
        return auth.getAuthorities().stream().anyMatch(a -> authority.equals(a.getAuthority()));
    }
}
