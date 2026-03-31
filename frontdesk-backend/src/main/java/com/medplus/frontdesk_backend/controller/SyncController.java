package com.medplus.frontdesk_backend.controller;

import com.medplus.frontdesk_backend.dto.ApiResponse;
import com.medplus.frontdesk_backend.dto.SyncResultDto;
import com.medplus.frontdesk_backend.service.SyncService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/api/sync")
@RequiredArgsConstructor
public class SyncController {

    private final SyncService syncService;

    /**
     * POST /api/sync/pull
     *
     * Pulls latest employee and location data from the external HR/ERP API
     * and upserts it into usermaster and locationmaster.
     *
     * Restricted to PRIMARY_ADMIN only.
     *
     * Success response (200):
     * {
     *   "success": true,
     *   "message": "Sync completed successfully",
     *   "data": {
     *     "locationsFetched":  5,
     *     "locationsInserted": 2,
     *     "locationsUpdated":  3,
     *     "employeesFetched":  20,
     *     "employeesInserted": 5,
     *     "employeesUpdated":  15,
     *     "triggeredBy":  "Admin",
     *     "syncedAt":     "2026-03-30 12:00:00"
     *   }
     * }
     */
    @PostMapping("/pull")
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN', 'REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<SyncResultDto>> pull(
            @AuthenticationPrincipal UserDetails principal) {

        String triggeredBy = principal != null ? principal.getUsername() : "UNKNOWN";
        log.info("Sync pull requested by: {}", triggeredBy);

        SyncResultDto result = syncService.sync(triggeredBy);
        return ResponseEntity.ok(ApiResponse.success("Sync completed successfully", result));
    }
}
