package com.medplus.frontdesk.backend.controller;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.medplus.frontdesk.backend.dto.dashboard.DashboardFlowPointDto;
import com.medplus.frontdesk.backend.dto.dashboard.DashboardKpiDto;
import com.medplus.frontdesk.backend.dto.dashboard.DashboardOverviewDto;
import com.medplus.frontdesk.backend.dto.dashboard.LocationOptionDto;
import com.medplus.frontdesk.backend.dto.dashboard.RecentVisitorDto;
import com.medplus.frontdesk.backend.dto.dashboard.VisitorTablePageDto;
import com.medplus.frontdesk.backend.service.DashboardService;

@RestController
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    // ── Admin: locations ──────────────────────────────────────────────────────

    /**
     * GET /admin/dashboard/locations
     * Returns all configured locations so the admin can populate the filter dropdown.
     */
    @GetMapping("/admin/dashboard/locations")
    public ResponseEntity<List<LocationOptionDto>> getLocations() {
        return ResponseEntity.ok(dashboardService.getLocations());
    }

    // ── Admin: KPIs ───────────────────────────────────────────────────────────

    /**
     * GET /admin/dashboard/kpis?locationId=LOC001&fromDate=2026-03-26&toDate=2026-03-26
     *
     * Returns all nine KPI values at once (All / Employee / NonEmployee breakdowns
     * for check-ins, check-outs, and live active count). No visitorType filter —
     * all values are always returned so the frontend can switch tabs client-side.
     */
    @GetMapping("/admin/dashboard/kpis")
    public ResponseEntity<DashboardKpiDto> getAdminKpis(
            @RequestParam(required = false) String locationId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate) {
        return ResponseEntity.ok(dashboardService.getAdminKpis(locationId, fromDate, toDate));
    }

    // ── Admin: visitor flow ───────────────────────────────────────────────────

    /**
     * GET /admin/dashboard/visitor-flow?locationId=LOC001&visitorType=ALL&fromDate=...&toDate=...
     *
     * Hourly check-in counts for the SVG area chart.
     * visitorType: ALL | EMPLOYEE | NONEMPLOYEE
     */
    @GetMapping("/admin/dashboard/visitor-flow")
    public ResponseEntity<List<DashboardFlowPointDto>> getAdminVisitorFlow(
            @RequestParam(required = false) String locationId,
            @RequestParam(defaultValue = "ALL") String visitorType,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate) {
        return ResponseEntity.ok(
                dashboardService.getAdminVisitorFlow(locationId, visitorType, fromDate, toDate));
    }

    // ── Admin: recent visitors ────────────────────────────────────────────────

    /**
     * GET /admin/dashboard/recent-visitors?locationId=LOC001&visitorType=ALL&limit=10&fromDate=...&toDate=...
     */
    @GetMapping("/admin/dashboard/recent-visitors")
    public ResponseEntity<List<RecentVisitorDto>> getAdminRecentVisitors(
            @RequestParam(required = false) String locationId,
            @RequestParam(defaultValue = "ALL") String visitorType,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(
                dashboardService.getAdminRecentVisitors(locationId, visitorType, fromDate, toDate, limit));
    }

    // ── Admin: full overview (single call) ────────────────────────────────────

    /**
     * GET /admin/dashboard/overview?locationId=LOC001&visitorType=ALL&fromDate=...&toDate=...
     *
     * Bundles KPIs + visitor-flow + recent-visitors into one payload, handy
     * for the initial page load.
     */
    @GetMapping("/admin/dashboard/overview")
    public ResponseEntity<DashboardOverviewDto> getAdminOverview(
            @RequestParam(required = false) String locationId,
            @RequestParam(defaultValue = "ALL") String visitorType,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate) {
        return ResponseEntity.ok(
                dashboardService.getAdminOverview(locationId, visitorType, fromDate, toDate));
    }

      @GetMapping("/user/dashboard/kpis")
    public ResponseEntity<DashboardKpiDto> getUserKpis(
            Authentication authentication,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate) {
        return ResponseEntity.ok(
                dashboardService.getUserKpis(authentication.getName(), fromDate, toDate));
    }

    // ── User: locations (for check-in form dropdown) ─────────────────────────

    /**
     * GET /user/dashboard/locations
     * Returns all configured locations so the front-desk user can populate
     * the location dropdown in the check-in wizard.
     */
    @GetMapping("/user/dashboard/locations")
    public ResponseEntity<List<LocationOptionDto>> getUserLocations() {
        return ResponseEntity.ok(dashboardService.getLocations());
    }

    // ── User: visitor flow ────────────────────────────────────────────────────

    @GetMapping("/user/dashboard/visitor-flow")
    public ResponseEntity<List<DashboardFlowPointDto>> getUserVisitorFlow(
            Authentication authentication,
            @RequestParam(defaultValue = "ALL") String visitorType,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate) {
        return ResponseEntity.ok(
                dashboardService.getUserVisitorFlow(
                        authentication.getName(), visitorType, fromDate, toDate));
    }

    // ── User: recent visitors ─────────────────────────────────────────────────

    @GetMapping("/user/dashboard/recent-visitors")
    public ResponseEntity<List<RecentVisitorDto>> getUserRecentVisitors(
            Authentication authentication,
            @RequestParam(defaultValue = "ALL") String visitorType,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(
                dashboardService.getUserRecentVisitors(
                        authentication.getName(), visitorType, fromDate, toDate, limit));
    }

    // ── User: full overview ───────────────────────────────────────────────────

    @GetMapping("/user/dashboard/overview")
    public ResponseEntity<DashboardOverviewDto> getUserOverview(
            Authentication authentication,
            @RequestParam(defaultValue = "ALL") String visitorType,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate) {
        return ResponseEntity.ok(
                dashboardService.getUserOverview(
                        authentication.getName(), visitorType, fromDate, toDate));
    }

    // ── Admin: visitors table (paginated) ─────────────────────────────────────

    /**
     * GET /admin/dashboard/visitors
     *
     * Full-featured paginated table query for the dashboard visitors table.
     *
     * Query params:
     *   locationId  – filter to a specific location (omit = all locations)
     *   visitorType – ALL | EMPLOYEE | NONEMPLOYEE  (default ALL)
     *   status      – ALL | CheckedIn | CheckedOut  (default ALL)
     *   fromDate    – ISO date, start of window     (default today)
     *   toDate      – ISO date, end of window       (default today)
     *   search      – free-text on name / ID        (optional)
     *   page        – 0-based page index            (default 0)
     *   pageSize    – rows per page, max 50         (default 10)
     *
     * Response: VisitorTablePageDto with rows + pagination metadata.
     */
    @GetMapping("/admin/dashboard/visitors")
    public ResponseEntity<VisitorTablePageDto> getAdminVisitors(
            @RequestParam(required = false) String locationId,
            @RequestParam(defaultValue = "ALL") String visitorType,
            @RequestParam(defaultValue = "ALL") String status,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int pageSize) {

        return ResponseEntity.ok(
                dashboardService.getAdminVisitors(
                        locationId, visitorType, status, search,
                        fromDate, toDate, page, pageSize));
    }

    // ── User: visitors table (paginated) ──────────────────────────────────────

    /**
     * GET /user/dashboard/visitors
     *
     * Same as the admin endpoint but the location is auto-resolved from the
     * logged-in user's profile — no locationId parameter accepted.
     */
    @GetMapping("/user/dashboard/visitors")
    public ResponseEntity<VisitorTablePageDto> getUserVisitors(
            Authentication authentication,
            @RequestParam(defaultValue = "ALL") String visitorType,
            @RequestParam(defaultValue = "ALL") String status,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int pageSize) {

        return ResponseEntity.ok(
                dashboardService.getUserVisitors(
                        authentication.getName(),
                        visitorType, status, search,
                        fromDate, toDate, page, pageSize));
    }
}
