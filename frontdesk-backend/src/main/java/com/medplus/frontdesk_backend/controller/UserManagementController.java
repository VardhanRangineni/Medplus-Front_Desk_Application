package com.medplus.frontdesk_backend.controller;

import com.medplus.frontdesk_backend.dto.ApiResponse;
import com.medplus.frontdesk_backend.dto.DeviceResetRequestDto;
import com.medplus.frontdesk_backend.dto.DeviceResetResponseDto;
import com.medplus.frontdesk_backend.service.UserManagementService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserManagementController {

    private final UserManagementService userManagementService;

    /**
     * Update a user's registered MAC address (mandatory new value).
     *
     * PUT /api/users/{employeeId}/reset-mac
     * Authorization: Bearer <token>
     *
     * Request body:
     * {
     *   "newMacAddress": "BB:CC:DD:EE:FF:00",        ← required
     *   "reason":        "Employee changed workstation" ← optional
     * }
     *
     * Roles allowed:
     *  - PRIMARY_ADMIN  → can update MAC for REGIONAL_ADMIN or RECEPTIONIST
     *  - REGIONAL_ADMIN → can only update MAC for RECEPTIONIST
     */
    @PutMapping("/{employeeId}/reset-mac")
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN', 'REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<DeviceResetResponseDto>> resetDeviceMac(
            @PathVariable String employeeId,
            @Valid @RequestBody DeviceResetRequestDto request,
            Authentication authentication) {

        String callerEmployeeId = authentication.getName();
        String callerRole = extractRole(authentication);

        DeviceResetResponseDto result =
                userManagementService.resetDeviceMac(employeeId, request, callerEmployeeId, callerRole);

        return ResponseEntity.ok(ApiResponse.success("Device MAC address updated successfully.", result));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String extractRole(Authentication authentication) {
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(a -> a.startsWith("ROLE_"))
                .map(a -> a.replace("ROLE_", ""))
                .findFirst()
                .orElse("");
    }
}
