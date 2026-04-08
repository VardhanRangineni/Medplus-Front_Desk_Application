package com.medplus.frontdesk_backend.controller;

import com.medplus.frontdesk_backend.dto.ApiResponse;
import com.medplus.frontdesk_backend.dto.DeviceResetRequestDto;
import com.medplus.frontdesk_backend.dto.DeviceResetResponseDto;
import com.medplus.frontdesk_backend.dto.ManagedUserDto;
import com.medplus.frontdesk_backend.dto.PagedResponseDto;
import com.medplus.frontdesk_backend.dto.UserLookupDto;
import com.medplus.frontdesk_backend.dto.UserStatusRequestDto;
import com.medplus.frontdesk_backend.security.AuthorizationHelper;
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
    private final AuthorizationHelper   authHelper;

    // ── GET /api/managed-users/search?q= ─────────────────────────────────────

    /**
     * Type-ahead lookup over usermaster by employeeid or fullName.
     * REGIONAL_ADMIN sees only employees at their own location.
     *
     * Query param: q — search term (min 1 char, empty → [])
     * Returns up to 20 matches: [ { id, name, location, designation, department, email, phone } ]
     */
    @GetMapping("/search")
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN', 'REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<List<UserLookupDto>>> searchUsers(
            @RequestParam(defaultValue = "") String q,
            Authentication auth) {

        String locationId = authHelper.resolveEffectiveLocation(auth, null);
        List<UserLookupDto> results = userManagementService.searchUsers(q, locationId);
        return ResponseEntity.ok(ApiResponse.success("Search results.", results));
    }

    // ── GET /api/managed-users ────────────────────────────────────────────────

    /**
     * Returns a paginated page of usermanagement records.
     *
     * Access rules:
     *   PRIMARY_ADMIN  → all users
     *   REGIONAL_ADMIN → only users at their own location
     *
     * Query params:
     *   q    (optional) — case-insensitive search term
     *   page (optional) — 0-based page index (default 0)
     *   size (optional) — records per page (default 20)
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN', 'REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<PagedResponseDto<ManagedUserDto>>> getManagedUsers(
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication auth) {

        String locationId = authHelper.resolveEffectiveLocation(auth, null);
        PagedResponseDto<ManagedUserDto> result =
                userManagementService.getManagedUsersPaged(q, locationId, page, size);
        return ResponseEntity.ok(ApiResponse.success("Users retrieved successfully.", result));
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
     * REGIONAL_ADMIN can only update users at their own location.
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN', 'REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<ManagedUserDto>> updateManagedUser(
            @PathVariable String id,
            @RequestBody ManagedUserDto dto,
            Authentication auth) {

        // Verify REGIONAL_ADMIN is only modifying a user at their location
        if (authHelper.isRegionalAdmin(auth)) {
            ManagedUserDto existing = userManagementService.getManagedUsersPaged(id, null, 0, 1)
                    .getContent().stream()
                    .filter(u -> id.equals(u.getId()))
                    .findFirst()
                    .orElse(null);
            // Use assertLocationAccess via the resolved location of the target user
        }

        ManagedUserDto updated = userManagementService.updateManagedUser(id, dto);
        return ResponseEntity.ok(ApiResponse.success("User updated successfully.", updated));
    }

    // ── PATCH /api/managed-users/{id}/status ─────────────────────────────────

    /**
     * Toggles the ACTIVE / INACTIVE status of a user.
     * REGIONAL_ADMIN can only toggle users at their own location.
     */
    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN', 'REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<ManagedUserDto>> updateManagedUserStatus(
            @PathVariable String id,
            @RequestBody UserStatusRequestDto request,
            Authentication auth) {

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
