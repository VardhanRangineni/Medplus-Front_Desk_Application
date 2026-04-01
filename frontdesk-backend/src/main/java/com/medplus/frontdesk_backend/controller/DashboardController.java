package com.medplus.frontdesk_backend.controller;

import com.medplus.frontdesk_backend.dto.ApiResponse;
import com.medplus.frontdesk_backend.dto.DashboardStatsDto;
import com.medplus.frontdesk_backend.service.DashboardService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    /**
     * GET /api/dashboard/stats
     *
     * Returns today's aggregated statistics for the dashboard home screen.
     * Scope is automatically determined from the caller's role:
     *  - RECEPTIONIST         → their assigned location only
     *  - PRIMARY/REGIONAL ADMIN → all locations
     *
     * Response body (data field):
     * {
     *   "todayCheckinsAll":       23,
     *   "todayCheckinsEmp":       5,
     *   "todayCheckinsNonEmp":    18,
     *   "todayCheckoutsAll":      8,
     *   "todayCheckoutsEmp":      2,
     *   "todayCheckoutsNonEmp":   6,
     *   "activeInBuildingAll":    15,
     *   "activeInBuildingEmp":    3,
     *   "activeInBuildingNonEmp": 12,
     *   "pendingSignouts":        15,
     *   "visitorFlow": [
     *     { "label": "9am",  "all": 4, "employee": 1, "nonEmployee": 3 },
     *     { "label": "10am", "all": 7, "employee": 2, "nonEmployee": 5 },
     *     ...
     *   ]
     * }
     */
    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<DashboardStatsDto>> getStats(Authentication auth) {
        DashboardStatsDto stats = dashboardService.getStats(auth.getName(), auth);
        return ResponseEntity.ok(ApiResponse.success("Dashboard stats retrieved.", stats));
    }
}
