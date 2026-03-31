package com.medplus.frontdesk_backend.controller;

import com.medplus.frontdesk_backend.dto.ApiResponse;
import com.medplus.frontdesk_backend.dto.DeviceResetRequestDto;
import com.medplus.frontdesk_backend.dto.DeviceResetResponseDto;
import com.medplus.frontdesk_backend.dto.ManagedUserDto;
import com.medplus.frontdesk_backend.dto.UserLookupDto;
import com.medplus.frontdesk_backend.dto.UserStatusRequestDto;
import com.medplus.frontdesk_backend.service.UserManagementService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/managed-users")
@RequiredArgsConstructor
public class UserManagementController {

    private final UserManagementService userManagementService;

    // ── GET /api/managed-users/search?q= ─────────────────────────────────────

    /**
     * Type-ahead lookup over usermaster by employeeid or fullName.
     *
     * Used by the Add / Edit User modal to auto-fill form fields when the
     * operator types in the Employee ID or Employee Name input.
     *
     * Query param: q  — search term (min 1 char, empty → [])
     *
     * Returns up to 20 matches: [ { id, name, location, designation, department, email, phone } ]
     */
    @GetMapping("/search")
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN', 'REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<List<UserLookupDto>>> searchUsers(
            @RequestParam(defaultValue = "") String q) {

        List<UserLookupDto> results = userManagementService.searchUsers(q);
        return ResponseEntity.ok(ApiResponse.success("Search results.", results));
    }

    // ── GET /api/managed-users ────────────────────────────────────────────────

    /**
     * Returns all usermanagement records with location resolved to descriptive name.
     * Accessible to PRIMARY_ADMIN and REGIONAL_ADMIN.
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN', 'REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<List<ManagedUserDto>>> getManagedUsers() {
        List<ManagedUserDto> users = userManagementService.getManagedUsers();
        return ResponseEntity.ok(ApiResponse.success("Users retrieved successfully.", users));
    }

    // ── POST /api/managed-users ───────────────────────────────────────────────

    /**
     * Creates a new usermanagement record (and a minimal usermaster if absent).
     *
     * Request body: { id, name, location, ipAddress, macAddress, status }
     *   - location : descriptive name or LocationId from locationmaster
     *   - role     : always defaults to RECEPTIONIST
     *   - password : always defaults to BCrypt(employeeId)
     *
     * Restricted to PRIMARY_ADMIN.
     */
    @PostMapping
    @PreAuthorize("hasRole('PRIMARY_ADMIN')")
    public ResponseEntity<ApiResponse<ManagedUserDto>> createManagedUser(
            @RequestBody ManagedUserDto dto) {

        ManagedUserDto created = userManagementService.createManagedUser(dto);
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success("User created successfully.", created));
    }

    // ── PUT /api/managed-users/{id} ───────────────────────────────────────────

    /**
     * Updates an existing usermanagement record (name, location, IP, MAC, status).
     *
     * Request body: { name, location, ipAddress, macAddress, status }
     *
     * Restricted to PRIMARY_ADMIN and REGIONAL_ADMIN.
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN', 'REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<ManagedUserDto>> updateManagedUser(
            @PathVariable String id,
            @RequestBody ManagedUserDto dto) {

        ManagedUserDto updated = userManagementService.updateManagedUser(id, dto);
        return ResponseEntity.ok(ApiResponse.success("User updated successfully.", updated));
    }

    // ── PATCH /api/managed-users/{id}/status ─────────────────────────────────

    /**
     * Toggles the ACTIVE / INACTIVE status of a user.
     *
     * Request body: { "status": true }
     *
     * Restricted to PRIMARY_ADMIN and REGIONAL_ADMIN.
     */
    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN', 'REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<ManagedUserDto>> updateManagedUserStatus(
            @PathVariable String id,
            @RequestBody UserStatusRequestDto request) {

        ManagedUserDto updated = userManagementService.updateManagedUserStatus(id, request.isStatus());
        String msg = request.isStatus() ? "User activated." : "User deactivated.";
        return ResponseEntity.ok(ApiResponse.success(msg, updated));
    }

    // ── PUT /api/managed-users/{employeeId}/reset-mac ─────────────────────────

    /**
     * Overwrites the registered MAC address for a target user (device re-registration).
     *
     * Request body:
     * {
     *   "newMacAddress": "BB:CC:DD:EE:FF:00",         ← required
     *   "reason":        "Employee changed workstation" ← optional
     * }
     *
     * Role hierarchy enforced in the service:
     *   PRIMARY_ADMIN  → can reset MAC for REGIONAL_ADMIN or RECEPTIONIST
     *   REGIONAL_ADMIN → can only reset MAC for RECEPTIONIST
     */
    @PutMapping("/{employeeId}/reset-mac")
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN', 'REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<DeviceResetResponseDto>> resetDeviceMac(
            @PathVariable String employeeId,
            @Valid @RequestBody DeviceResetRequestDto request,
            Authentication authentication) {

        String callerEmployeeId = authentication.getName();
        String callerRole       = extractRole(authentication);

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
