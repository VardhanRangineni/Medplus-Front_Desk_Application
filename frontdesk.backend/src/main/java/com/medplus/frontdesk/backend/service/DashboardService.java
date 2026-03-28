package com.medplus.frontdesk.backend.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import com.medplus.frontdesk.backend.dto.dashboard.DashboardFlowPointDto;
import com.medplus.frontdesk.backend.dto.dashboard.DashboardKpiDto;
import com.medplus.frontdesk.backend.dto.dashboard.DashboardOverviewDto;
import com.medplus.frontdesk.backend.dto.dashboard.LocationOptionDto;
import com.medplus.frontdesk.backend.dto.dashboard.RecentVisitorDto;
import com.medplus.frontdesk.backend.dto.dashboard.VisitorTablePageDto;
import com.medplus.frontdesk.backend.repository.DashboardRepository;
import com.medplus.frontdesk.backend.repository.UsersRepository;
import com.medplus.frontdesk.backend.security.UserPrincipal;

@Service
public class DashboardService {

    private final DashboardRepository dashboardRepository;
    private final UsersRepository usersRepository;

    public DashboardService(DashboardRepository dashboardRepository, UsersRepository usersRepository) {
        this.dashboardRepository = dashboardRepository;
        this.usersRepository = usersRepository;
    }

    // ── Admin methods ────────────────────────────────────────────────────────

    public DashboardOverviewDto getAdminOverview(
            String locationId,
            String visitorType,
            LocalDate fromDate,
            LocalDate toDate) {
        DateRange range = resolveDateRange(fromDate, toDate);
        return buildOverview(locationId, visitorType, range);
    }

    /** KPIs carry all breakdowns; no visitorType filter applied to them. */
    public DashboardKpiDto getAdminKpis(
            String locationId,
            LocalDate fromDate,
            LocalDate toDate) {
        DateRange range = resolveDateRange(fromDate, toDate);
        return dashboardRepository.fetchKpis(range.start(), range.end(), locationId);
    }

    public List<DashboardFlowPointDto> getAdminVisitorFlow(
            String locationId,
            String visitorType,
            LocalDate fromDate,
            LocalDate toDate) {
        DateRange range = resolveDateRange(fromDate, toDate);
        return dashboardRepository.fetchVisitorFlow(
                range.start(), range.end(), locationId, normalizeVisitorType(visitorType));
    }

    public List<RecentVisitorDto> getAdminRecentVisitors(
            String locationId,
            String visitorType,
            LocalDate fromDate,
            LocalDate toDate,
            int limit) {
        DateRange range = resolveDateRange(fromDate, toDate);
        return dashboardRepository.fetchRecentVisitors(
                range.start(), range.end(), locationId, normalizeVisitorType(visitorType), limit);
    }

    // ── User methods (location is derived from their profile) ───────────────

    public DashboardOverviewDto getUserOverview(
            Authentication authentication,
            String visitorType,
            LocalDate fromDate,
            LocalDate toDate) {
        String locationId = resolveUserLocation(authentication);
        DateRange range = resolveDateRange(fromDate, toDate);
        return buildOverview(locationId, visitorType, range);
    }

    public DashboardKpiDto getUserKpis(
            Authentication authentication,
            LocalDate fromDate,
            LocalDate toDate) {
        String locationId = resolveUserLocation(authentication);
        DateRange range = resolveDateRange(fromDate, toDate);
        return dashboardRepository.fetchKpis(range.start(), range.end(), locationId);
    }

    public List<DashboardFlowPointDto> getUserVisitorFlow(
            Authentication authentication,
            String visitorType,
            LocalDate fromDate,
            LocalDate toDate) {
        String locationId = resolveUserLocation(authentication);
        DateRange range = resolveDateRange(fromDate, toDate);
        return dashboardRepository.fetchVisitorFlow(
                range.start(), range.end(), locationId, normalizeVisitorType(visitorType));
    }

    public List<RecentVisitorDto> getUserRecentVisitors(
            Authentication authentication,
            String visitorType,
            LocalDate fromDate,
            LocalDate toDate,
            int limit) {
        String locationId = resolveUserLocation(authentication);
        DateRange range = resolveDateRange(fromDate, toDate);
        return dashboardRepository.fetchRecentVisitors(
                range.start(), range.end(), locationId, normalizeVisitorType(visitorType), limit);
    }

    // ── Shared ───────────────────────────────────────────────────────────────

    public List<LocationOptionDto> getLocations() {
        return dashboardRepository.fetchLocations();
    }

    // ── Visitor table (paginated) ─────────────────────────────────────────────

    /**
     * Admin view: location is an explicit filter parameter.
     *
     * @param locationId  null / blank = all locations
     * @param visitorType ALL | EMPLOYEE | NONEMPLOYEE
     * @param status      ALL | CheckedIn | CheckedOut
     * @param search      optional free-text on name / ID
     * @param page        0-based page index
     * @param pageSize    rows per page (1-50)
     */
    public VisitorTablePageDto getAdminVisitors(
            String locationId,
            String visitorType,
            String status,
            String search,
            LocalDate fromDate,
            LocalDate toDate,
            int page,
            int pageSize) {

        DateRange range = resolveDateRange(fromDate, toDate);
        return buildVisitorPage(
                locationId, visitorType, status, search, range, page, pageSize);
    }

    /**
     * User view: location is resolved from the authenticated principal.
     */
    public VisitorTablePageDto getUserVisitors(
            Authentication authentication,
            String visitorType,
            String status,
            String search,
            LocalDate fromDate,
            LocalDate toDate,
            int page,
            int pageSize) {

        String locationId = resolveUserLocation(authentication);
        DateRange range   = resolveDateRange(fromDate, toDate);
        return buildVisitorPage(
                locationId, visitorType, status, search, range, page, pageSize);
    }

    private VisitorTablePageDto buildVisitorPage(
            String locationId,
            String visitorType,
            String status,
            String search,
            DateRange range,
            int page,
            int pageSize) {

        int safePageSize = Math.max(1, Math.min(pageSize, 50));
        int safePage     = Math.max(0, page);
        int offset       = safePage * safePageSize;

        String normType   = normalizeVisitorType(visitorType);
        String normStatus = normalizeStatus(status);

        int total = dashboardRepository.countVisitorsTotal(
                range.start(), range.end(), locationId, normType, normStatus, search);

        java.util.List<RecentVisitorDto> rows = dashboardRepository.fetchVisitorsPaged(
                range.start(), range.end(),
                locationId, normType, normStatus, search,
                offset, safePageSize);

        int totalPages = total == 0 ? 1 : (int) Math.ceil((double) total / safePageSize);

        return new VisitorTablePageDto(
                rows, safePage, safePageSize, total, totalPages,
                locationId, normType, normStatus);
    }

    private String normalizeStatus(String status) {
        if (status == null || status.isBlank()) return "ALL";
        return switch (status.trim()) {
            case "CheckedIn"  -> "CheckedIn";
            case "CheckedOut" -> "CheckedOut";
            default           -> "ALL";
        };
    }

    // ── Internals ────────────────────────────────────────────────────────────

    private DashboardOverviewDto buildOverview(String locationId, String visitorType, DateRange range) {
        String normType = normalizeVisitorType(visitorType);

        DashboardKpiDto kpis = dashboardRepository.fetchKpis(range.start(), range.end(), locationId);

        List<DashboardFlowPointDto> flow = dashboardRepository.fetchVisitorFlow(
                range.start(), range.end(), locationId, normType);

        List<RecentVisitorDto> recentVisitors = dashboardRepository.fetchRecentVisitors(
                range.start(), range.end(), locationId, normType, 10);

        return new DashboardOverviewDto(
                locationId, normType, range.fromDate(), range.toDate(),
                kpis, flow, recentVisitors);
    }

    /**
     * Reads the user's locationId from the Spring Security principal.
     * Since {@link com.medplus.frontdesk.backend.security.CustomUserDetailsService}
     * now returns a {@link UserPrincipal}, this is a zero-DB-query operation.
     * Falls back to a DB lookup only if the principal is not a {@link UserPrincipal}
     * (e.g. during testing or when using a different auth flow).
     */
    private String resolveUserLocation(Authentication authentication) {
        if (authentication != null
                && authentication.getPrincipal() instanceof UserPrincipal principal) {
            return principal.getLocationId();
        }
        String username = authentication != null ? authentication.getName() : null;
        if (username == null) return null;
        return usersRepository.findByUsername(username)
                .map(u -> u.getLocation())
                .orElse(null);
    }

    private DateRange resolveDateRange(LocalDate fromDate, LocalDate toDate) {
        LocalDate from = fromDate;
        LocalDate to   = toDate;

        if (from == null && to == null) {
            from = LocalDate.now();
            to   = from;
        } else if (from == null) {
            from = to;
        } else if (to == null) {
            to = from;
        }

        if (to.isBefore(from)) to = from;

        return new DateRange(from, to, from.atStartOfDay(), to.plusDays(1).atStartOfDay());
    }

    private String normalizeVisitorType(String visitorType) {
        if (visitorType == null || visitorType.isBlank()) return "ALL";
        String v = visitorType.trim().toUpperCase();
        return "EMPLOYEE".equals(v) || "NONEMPLOYEE".equals(v) ? v : "ALL";
    }

    private record DateRange(LocalDate fromDate, LocalDate toDate, LocalDateTime start, LocalDateTime end) {}
}
