package com.medplus.frontdesk_backend.controller;

import com.medplus.frontdesk_backend.dto.ApiResponse;
import com.medplus.frontdesk_backend.dto.ManagedUserDto;
import com.medplus.frontdesk_backend.dto.TempDeviceGrantDto;
import com.medplus.frontdesk_backend.dto.TempDeviceGrantRequestDto;
import com.medplus.frontdesk_backend.dto.PagedResponseDto;
import com.medplus.frontdesk_backend.dto.RoleDto;
import com.medplus.frontdesk_backend.dto.UserLookupDto;
import com.medplus.frontdesk_backend.dto.UserStatusRequestDto;
import com.medplus.frontdesk_backend.model.UserRole;
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
import org.springframework.web.bind.annotation.DeleteMapping;
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

    // ── GET /api/managed-users/roles ─────────────────────────────────────────

    /**
     * Returns the full list of available application roles (Admin, Supervisor, Receptionist).
     * Used by the frontend to populate the role selector in the Add / Edit User modal.
     */
    @GetMapping("/roles")
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN', 'REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<List<RoleDto>>> getRoles(Authentication auth) {
        return ResponseEntity.ok(ApiResponse.success("Roles retrieved.", userManagementService.getRoles(auth)));
    }

    // ── GET /api/managed-users/search?q= ─────────────────────────────────────

    /**
     * Type-ahead lookup over usermanagement directory by employeeid or fullName.
     * REGIONAL_ADMIN sees only employees they created.
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
        UserRole callerRole = userRoleFromAuth(auth);
        List<UserLookupDto> results = userManagementService.searchUsers(q, locationId, callerRole, auth.getName());
        return ResponseEntity.ok(ApiResponse.success("Search results.", results));
    }

    // ── GET /api/managed-users ────────────────────────────────────────────────

    /**
     * Returns a paginated page of usermanagement records.
     *
     * Access rules:
     *   PRIMARY_ADMIN  → all users
     *   REGIONAL_ADMIN → only users they created
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
            @RequestParam(required = false) Integer roleId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication auth) {

        String locationId = authHelper.resolveEffectiveLocation(auth, null);
        UserRole callerRole = userRoleFromAuth(auth);
        PagedResponseDto<ManagedUserDto> result =
                userManagementService.getManagedUsersPaged(q, locationId, page, size, roleId, status,
                        callerRole, auth.getName());
        return ResponseEntity.ok(ApiResponse.success("Users retrieved successfully.", result));
    }

    // ── GET /api/managed-users/{id} ───────────────────────────────────────────

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN', 'REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<ManagedUserDto>> getManagedUser(
            @PathVariable String id,
            Authentication auth) {

        UserRole callerRole = userRoleFromAuth(auth);
        ManagedUserDto user = userManagementService.getManagedUser(id, callerRole, auth.getName());
        return ResponseEntity.ok(ApiResponse.success("User retrieved successfully.", user));
    }

    // ── POST /api/managed-users ───────────────────────────────────────────────

    /**
     * Creates a new usermanagement record (and a minimal usermaster if absent).
     *
     * Request body: { id, name, location, assignedDeviceId, status, roleId }
     *   - location : descriptive name or LocationId from locationmaster
     *   - role     : always defaults to RECEPTIONIST
     *   - password : always defaults to BCrypt(employeeId)
     *
     * PRIMARY_ADMIN can create REGIONAL_ADMIN + RECEPTIONIST.
     * REGIONAL_ADMIN can create RECEPTIONIST only (own location).
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN', 'REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<ManagedUserDto>> createManagedUser(
            @RequestBody ManagedUserDto dto,
            Authentication auth) {

        UserRole callerRole = userRoleFromAuth(auth);
        ManagedUserDto created = userManagementService.createManagedUser(dto, auth.getName(), callerRole);
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

        UserRole callerRole = userRoleFromAuth(auth);
        ManagedUserDto updated = userManagementService.updateManagedUser(id, dto, auth.getName(), callerRole);
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

        UserRole callerRole = userRoleFromAuth(auth);
        ManagedUserDto updated = userManagementService.updateManagedUserStatus(
                id, request.isStatus(), auth.getName(), callerRole);
        String msg = request.isStatus() ? "User activated." : "User deactivated.";
        return ResponseEntity.ok(ApiResponse.success(msg, updated));
    }

    // ── POST /api/managed-users/{employeeId}/temp-device-grant ────────────────

    @PostMapping("/{employeeId}/temp-device-grant")
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN', 'REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<TempDeviceGrantDto>> grantTempDeviceAccess(
            @PathVariable String employeeId,
            @Valid @RequestBody TempDeviceGrantRequestDto request,
            Authentication authentication) {

        TempDeviceGrantDto result = userManagementService.grantTempDeviceAccess(
                employeeId, request, authentication.getName(), userRoleFromAuth(authentication).name());
        return ResponseEntity.ok(ApiResponse.success("Temporary desk access granted.", result));
    }

    // ── DELETE /api/managed-users/{employeeId}/temp-device-grant ──────────────

    @DeleteMapping("/{employeeId}/temp-device-grant")
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN', 'REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<TempDeviceGrantDto>> revokeTempDeviceAccess(
            @PathVariable String employeeId,
            Authentication authentication) {

        TempDeviceGrantDto result = userManagementService.revokeTempDeviceAccess(
                employeeId, authentication.getName(), userRoleFromAuth(authentication).name());
        return ResponseEntity.ok(ApiResponse.success("Temporary desk access revoked.", result));
    }

    // ── GET /api/managed-users/{employeeId}/temp-device-grant ─────────────────

    @GetMapping("/{employeeId}/temp-device-grant")
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN', 'REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<TempDeviceGrantDto>> getActiveTempDeviceGrant(
            @PathVariable String employeeId) {

        TempDeviceGrantDto grant = userManagementService.getActiveTempDeviceGrant(employeeId);
        if (grant == null) {
            return ResponseEntity.ok(ApiResponse.success("No active temporary access.", null));
        }
        return ResponseEntity.ok(ApiResponse.success("Active temporary access.", grant));
    }

    // ── GET /api/managed-users/{employeeId}/temp-device-grants ────────────────

    @GetMapping("/{employeeId}/temp-device-grants")
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN', 'REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<List<TempDeviceGrantDto>>> getTempDeviceGrantHistory(
            @PathVariable String employeeId,
            @RequestParam(defaultValue = "20") int limit) {

        List<TempDeviceGrantDto> history =
                userManagementService.getTempDeviceGrantHistory(employeeId, limit);
        return ResponseEntity.ok(ApiResponse.success("Grant history.", history));
    }

    // ── POST /api/managed-users/{id}/reset-password ───────────────────────────

    /**
     * Resets the target user's password to their Employee ID in ALL CAPS.
     * PRIMARY_ADMIN can reset any non-admin account.
     * REGIONAL_ADMIN can only reset RECEPTIONIST accounts.
     */
    @PostMapping("/{id}/reset-password")
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN', 'REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> resetPassword(
            @PathVariable String id,
            Authentication auth) {

        String callerEmpId = auth.getName();
        String callerRole  = userRoleFromAuth(auth).name();
        userManagementService.resetPassword(id, callerEmpId, callerRole);
        return ResponseEntity.ok(ApiResponse.success(
                "Password reset to Employee ID (all caps) successfully.", null));
    }

    // ── POST /api/managed-users/me/change-password ────────────────────────────

    /**
     * Allows any authenticated user to change their own password.
     * Requires the current password for verification.
     *
     * Request body: { "currentPassword": "...", "newPassword": "..." }
     */
    @PostMapping("/me/change-password")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @RequestBody java.util.Map<String, String> body,
            Authentication auth) {

        String currentPassword = body.get("currentPassword");
        String newPassword     = body.get("newPassword");

        if (currentPassword == null || currentPassword.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Current password is required."));
        }
        if (newPassword == null || newPassword.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("New password is required."));
        }

        userManagementService.changePassword(auth.getName(), currentPassword, newPassword);
        return ResponseEntity.ok(ApiResponse.success("Password changed successfully.", null));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private UserRole userRoleFromAuth(Authentication authentication) {
        var roles = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(a -> a.startsWith("ROLE_"))
                .map(a -> a.substring("ROLE_".length()))
                .collect(java.util.stream.Collectors.toSet());
        if (roles.contains(UserRole.PRIMARY_ADMIN.name())) {
            return UserRole.PRIMARY_ADMIN;
        }
        if (roles.contains(UserRole.REGIONAL_ADMIN.name())) {
            return UserRole.REGIONAL_ADMIN;
        }
        return UserRole.RECEPTIONIST;
    }
}
