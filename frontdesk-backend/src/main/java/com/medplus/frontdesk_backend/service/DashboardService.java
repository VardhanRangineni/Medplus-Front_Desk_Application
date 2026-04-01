package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.dto.DashboardStatsDto;
import com.medplus.frontdesk_backend.dto.VisitorFlowPointDto;
import com.medplus.frontdesk_backend.model.UserManagement;
import com.medplus.frontdesk_backend.repository.UserRepository;
import com.medplus.frontdesk_backend.repository.VisitorRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class DashboardService {

    private final VisitorRepository visitorRepository;
    private final UserRepository    userRepository;

    /**
     * Returns aggregated dashboard statistics for today scoped to the caller's location.
     * Admins (PRIMARY_ADMIN / REGIONAL_ADMIN) see data across all locations.
     *
     * The response includes:
     *  - Today's check-in and check-out counts (total, employee, non-employee)
     *  - Currently active-in-building counts
     *  - Pending sign-outs (= active-in-building total)
     *  - Hourly visitor-flow data for the sparkline chart
     */
    public DashboardStatsDto getStats(String callerEmployeeId, Authentication auth) {
        String locationId = resolveLocationId(callerEmployeeId, auth);

        DashboardStatsDto stats = visitorRepository.findDashboardStats(locationId);
        List<VisitorFlowPointDto> flow = visitorRepository.findHourlyFlow(locationId);

        stats.setVisitorFlow(flow);

        log.debug("Dashboard stats fetched for location={} by {}", locationId, callerEmployeeId);
        return stats;
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Returns the caller's assigned locationId, or null if the caller is an admin
     * (which means all-locations scope).
     */
    private String resolveLocationId(String callerEmployeeId, Authentication auth) {
        if (isAdmin(auth)) return null;
        return userRepository.findByEmployeeId(callerEmployeeId)
                .map(UserManagement::getLocation)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                        "User not found in management records: " + callerEmployeeId));
    }

    private boolean isAdmin(Authentication auth) {
        if (auth == null) return false;
        return auth.getAuthorities().stream().anyMatch(a ->
                "ROLE_PRIMARY_ADMIN".equals(a.getAuthority()) ||
                "ROLE_REGIONAL_ADMIN".equals(a.getAuthority()));
    }
}
