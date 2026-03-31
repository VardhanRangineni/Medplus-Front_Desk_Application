package com.medplus.frontdesk_backend.controller;

import com.medplus.frontdesk_backend.dto.ApiResponse;
import com.medplus.frontdesk_backend.dto.LocationDto;
import com.medplus.frontdesk_backend.dto.LocationStatusRequestDto;
import com.medplus.frontdesk_backend.service.LocationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/locations")
@RequiredArgsConstructor
public class LocationController {

    private final LocationService locationService;

    /**
     * GET /api/locations/search?q=
     *
     * Type-ahead search over locationmaster by descriptiveName or LocationId.
     * Used by the Add / Edit User modal when the operator types in the Location field.
     *
     * Query param: q  — search term (empty → [])
     * Returns up to 20 matches: [ { code, name, address, city, state, status } ]
     */
    @GetMapping("/search")
    public ResponseEntity<ApiResponse<List<LocationDto>>> searchLocations(
            @RequestParam(defaultValue = "") String q) {

        List<LocationDto> results = locationService.searchLocations(q);
        return ResponseEntity.ok(ApiResponse.success("Search results.", results));
    }

    /**
     * GET /api/locations
     *
     * Returns all locations from the local locationmaster table.
     * Requires any authenticated user.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<LocationDto>>> getLocations() {
        List<LocationDto> locations = locationService.getAllLocations();
        return ResponseEntity.ok(ApiResponse.success("Locations retrieved successfully", locations));
    }

    /**
     * POST /api/locations/sync
     *
     * Pulls the latest location data from the external HR API,
     * upserts into locationmaster, and returns the full updated list.
     * Restricted to PRIMARY_ADMIN and REGIONAL_ADMIN.
     */
    @PostMapping("/sync")
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN', 'REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<List<LocationDto>>> syncLocations(
            @AuthenticationPrincipal UserDetails principal) {

        String triggeredBy = principal != null ? principal.getUsername() : "UNKNOWN";
        List<LocationDto> locations = locationService.syncAndGetLocations(triggeredBy);
        return ResponseEntity.ok(ApiResponse.success("Locations synced successfully", locations));
    }

    /**
     * PATCH /api/locations/{code}/status
     *
     * Toggles the active/inactive status of a location.
     * Restricted to PRIMARY_ADMIN and REGIONAL_ADMIN.
     *
     * Request body: { "status": true }
     */
    @PatchMapping("/{code}/status")
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN', 'REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<LocationDto>> updateStatus(
            @PathVariable String code,
            @RequestBody LocationStatusRequestDto request) {

        LocationDto updated = locationService.updateStatus(code, request.isStatus());
        String msg = request.isStatus() ? "Location activated" : "Location deactivated";
        return ResponseEntity.ok(ApiResponse.success(msg, updated));
    }
}
