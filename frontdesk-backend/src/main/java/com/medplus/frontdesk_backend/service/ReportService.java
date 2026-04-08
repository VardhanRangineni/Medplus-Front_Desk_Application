package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.dto.ReportAvgDurationDto;
import com.medplus.frontdesk_backend.dto.ReportDeptSummaryDto;
import com.medplus.frontdesk_backend.dto.ReportFrequentVisitorDto;
import com.medplus.frontdesk_backend.dto.ReportRatioDto;
import com.medplus.frontdesk_backend.model.UserManagement;
import com.medplus.frontdesk_backend.repository.ReportRepository;
import com.medplus.frontdesk_backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;

/**
 * Business logic for all Reports page aggregations.
 *
 * Scope rules (mirrors DashboardService):
 *  - RECEPTIONIST         → scoped to their assigned location only
 *  - PRIMARY/REGIONAL_ADMIN → all locations (locationId = null)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReportService {

    private final ReportRepository reportRepository;
    private final UserRepository   userRepository;

    // ── Public API ────────────────────────────────────────────────────────────

    public List<ReportDeptSummaryDto> getDeptSummary(
            String callerEmployeeId, Authentication auth,
            LocalDate from, LocalDate to, String locationIdParam) {

        String locationId = resolveLocationId(callerEmployeeId, auth, locationIdParam);
        log.debug("dept-summary from={} to={} location={} caller={}",
                from, to, locationId, callerEmployeeId);
        return reportRepository.findDeptSummary(from, to, locationId);
    }

    public ReportRatioDto getVisitorRatio(
            String callerEmployeeId, Authentication auth,
            LocalDate from, LocalDate to, String locationIdParam) {

        String locationId = resolveLocationId(callerEmployeeId, auth, locationIdParam);
        log.debug("visitor-ratio from={} to={} location={} caller={}",
                from, to, locationId, callerEmployeeId);
        return reportRepository.findVisitorRatio(from, to, locationId);
    }

    public List<ReportAvgDurationDto> getAvgDuration(
            String callerEmployeeId, Authentication auth,
            LocalDate from, LocalDate to, String locationIdParam) {

        String locationId = resolveLocationId(callerEmployeeId, auth, locationIdParam);
        log.debug("avg-duration from={} to={} location={} caller={}",
                from, to, locationId, callerEmployeeId);
        return reportRepository.findAvgDuration(from, to, locationId);
    }

    public List<ReportFrequentVisitorDto> getFrequentVisitors(
            String callerEmployeeId, Authentication auth,
            LocalDate from, LocalDate to, int minVisits, String locationIdParam) {

        String locationId = resolveLocationId(callerEmployeeId, auth, locationIdParam);
        log.debug("frequent-visitors from={} to={} minVisits={} location={} caller={}",
                from, to, minVisits, locationId, callerEmployeeId);
        return reportRepository.findFrequentVisitors(from, to, locationId, minVisits);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Resolves the effective locationId for filtering:
     *  - Non-admin: always the user's own assigned location (param is ignored).
     *  - Admin with a specific locationIdParam: filter to that location.
     *  - Admin with null/blank locationIdParam: no filter (all locations).
     */
    private String resolveLocationId(String callerEmployeeId, Authentication auth,
                                     String locationIdParam) {
        if (isAdmin(auth)) {
            String override = (locationIdParam != null && !locationIdParam.isBlank())
                    ? locationIdParam : null;
            return override;
        }
        return userRepository.findByEmployeeId(callerEmployeeId)
                .map(UserManagement::getLocation)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "User not found in management records: " + callerEmployeeId));
    }

    private boolean isAdmin(Authentication auth) {
        if (auth == null) return false;
        return auth.getAuthorities().stream().anyMatch(a ->
                "ROLE_PRIMARY_ADMIN".equals(a.getAuthority()) ||
                "ROLE_REGIONAL_ADMIN".equals(a.getAuthority()));
    }
}
