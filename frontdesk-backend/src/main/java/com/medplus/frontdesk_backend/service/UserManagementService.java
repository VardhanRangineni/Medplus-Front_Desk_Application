package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.dto.DeviceMasterDto;
import com.medplus.frontdesk_backend.dto.ManagedUserDto;
import com.medplus.frontdesk_backend.dto.PagedResponseDto;
import com.medplus.frontdesk_backend.dto.RoleDto;
import com.medplus.frontdesk_backend.dto.TempDeviceGrantDto;
import com.medplus.frontdesk_backend.dto.TempDeviceGrantRequestDto;
import com.medplus.frontdesk_backend.dto.UserLookupDto;
import com.medplus.frontdesk_backend.repository.UserDeviceGrantRepository;
import com.medplus.frontdesk_backend.util.WorkstationMacUtil;
import com.medplus.frontdesk_backend.exception.InvalidCredentialsException;
import com.medplus.frontdesk_backend.exception.UnauthorizedOperationException;
import com.medplus.frontdesk_backend.model.UserManagement;
import com.medplus.frontdesk_backend.model.UserRole;
import com.medplus.frontdesk_backend.model.UserStatus;
import com.medplus.frontdesk_backend.repository.UserRepository;
import com.medplus.frontdesk_backend.security.AuthorizationHelper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserManagementService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    private final UserRepository            userRepository;
    private final UserDeviceGrantRepository userDeviceGrantRepository;
    private final DeviceMasterService       deviceMasterService;
    private final BCryptPasswordEncoder     passwordEncoder;

    // ── Roles ─────────────────────────────────────────────────────────────────

    /** Full role list (PRIMARY_ADMIN). REGIONAL_ADMIN only sees Receptionist role. */
    public List<RoleDto> getRoles(Authentication auth) {
        List<RoleDto> all = userRepository.findAllRoles();
        if (auth == null || isPrimaryAdmin(auth)) {
            return all;
        }
        if (isRegionalAdmin(auth)) {
            return all.stream()
                    .filter(r -> "RECEPTIONIST".equals(r.getCode()))
                    .toList();
        }
        return all;
    }

    // ── List ──────────────────────────────────────────────────────────────────

    /**
     * Returns a single page of managed users, optionally filtered by search term and location.
     *
     * @param search     case-insensitive substring across id / name / ip / mac
     * @param locationId restrict to this location; null = all locations
     * @param page       0-based page index
     * @param size       records per page
     */
    public PagedResponseDto<ManagedUserDto> getManagedUsersPaged(String search, String locationId,
                                                                 int page, int size,
                                                                 Integer roleId, String accountStatus,
                                                                 UserRole callerRole, String callerEmployeeId) {
        int    offset = page * size;
        String q      = (search != null && !search.isBlank()) ? search : null;
        String creatorEmployerId = (callerRole == UserRole.REGIONAL_ADMIN && callerEmployeeId != null)
                ? callerEmployeeId.trim() : null;
        List<ManagedUserDto> rows  = userRepository.findManagedUsersPaged(
                q, null, creatorEmployerId, roleId, accountStatus, offset, size);
        enrichRoleMappings(rows);
        rows.forEach(row -> userDeviceGrantRepository.findActiveByEmployee(row.getId())
                .ifPresent(row::setActiveTempGrant));
        long total = userRepository.countManagedUsers(q, null, creatorEmployerId, roleId, accountStatus);
        return PagedResponseDto.of(rows, page, size, total);
    }

    /** Returns one managed user with active temp grant, if any. */
    public ManagedUserDto getManagedUser(String employeeId, UserRole callerRole, String callerEmployeeId) {
        ManagedUserDto dto = userRepository.findManagedUserById(employeeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "User '" + employeeId + "' not found."));

        if (callerRole == UserRole.REGIONAL_ADMIN) {
            assertRegionalOwnsTargetUser(dto, callerEmployeeId);
            if (!isReceptionistOnlyAccount(dto.getId())) {
                throw new UnauthorizedOperationException(
                        "You can only view Receptionist accounts you created.");
            }
        }

        enrichRoleMappings(List.of(dto));

        userDeviceGrantRepository.findActiveByEmployee(employeeId)
                .ifPresent(dto::setActiveTempGrant);
        return dto;
    }

    // ── Search / Lookup ───────────────────────────────────────────────────────

    /**
     * Type-ahead search over usermaster by employeeid or fullName.
     * When {@code locationId} is provided, results are scoped to that location.
     * Returns an empty list if the query is blank.
     */
    public List<UserLookupDto> searchUsers(String query, String locationId,
                                          UserRole callerRole, String callerEmployeeId) {
        if (query == null || query.isBlank()) return List.of();
        String creatorEmployerId = (callerRole == UserRole.REGIONAL_ADMIN && callerEmployeeId != null)
                ? callerEmployeeId.trim() : null;
        // Same scope as list: admin = all, supervisor = created-by only.
        return userRepository.searchDirectoryUsers(query, null, creatorEmployerId);
    }

    // ── Create ────────────────────────────────────────────────────────────────

    /**
     * Creates a new usermanagement record (and a minimal usermaster record if absent).
     *
     * Default role     : RECEPTIONIST
     * Default password : BCrypt(employeeId)
     */
    public ManagedUserDto createManagedUser(ManagedUserDto dto, String callerEmployeeId, UserRole callerRole) {

        String employeeId = dto.getId().trim();

        if (userRepository.existsInUserManagement(employeeId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "User '" + employeeId + "' already exists in the system.");
        }

        UserManagement caller = userRepository.findByEmployeeId(callerEmployeeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Caller not found."));

        List<Integer> roleIds = normalizeRoleIds(dto);
        int primaryRoleId = AuthorizationHelper.primaryRoleId(roleIds);

        List<ResolvedLocation> locs = resolveLocationsForRoleIds(roleIds, dto);

        if (callerRole == UserRole.REGIONAL_ADMIN && !isReceptionistOnlyRoleIds(roleIds)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Regional supervisors may only create Receptionist accounts.");
        }

        // Use admin-supplied password if provided; otherwise default to employee ID in ALL CAPS.
        String rawPassword = (dto.getPassword() != null && !dto.getPassword().isBlank())
                ? dto.getPassword()
                : employeeId.toUpperCase();
        String encoded = passwordEncoder.encode(rawPassword);
        UserStatus status = dto.isStatus() ? UserStatus.ACTIVE : UserStatus.INACTIVE;
        String assignedDeviceId = resolveAssignedDeviceId(roleIds, dto.getAssignedDeviceId(),
                callerEmployeeId, callerRole);
        ResolvedLocation primaryLoc = resolvePrimaryLocation(locs, assignedDeviceId);

        String workEmail = StringUtils.hasText(dto.getWorkEmail())
                ? dto.getWorkEmail().trim()
                : employeeId.toLowerCase() + "@medplus.com";
        String phone = StringUtils.hasText(dto.getPhone()) ? dto.getPhone().trim() : "0000000000";
        String designation = StringUtils.hasText(dto.getDesignation()) ? dto.getDesignation().trim() : "Employee";
        String department = StringUtils.hasText(dto.getDepartment()) ? dto.getDepartment().trim() : "General";

        userRepository.insertUserManagement(
                employeeId,
                dto.getName().trim(),
                workEmail,
                phone,
                designation,
                department,
                encoded,
                primaryLoc.code(),
                primaryLoc.name(),
                status,
                primaryRoleId,
                assignedDeviceId,
                true,
                callerEmployeeId
        );
        userRepository.replaceUserRoles(employeeId, roleIds);
        userRepository.replaceUserLocations(employeeId,
                locs.stream().map(ResolvedLocation::code).toList());

        log.info("[UserManagement] Created: {} ({}) roles={} locations={} by {}",
                employeeId, dto.getName(), roleIds,
                locs.stream().map(ResolvedLocation::code).toList(), callerEmployeeId);

        ManagedUserDto created = userRepository.findManagedUserById(employeeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "User was created but could not be retrieved."));
        enrichRoleMappings(List.of(created));
        return created;
    }

    // ── Update ────────────────────────────────────────────────────────────────

    /**
     * Updates name, location, IP address, MAC address, and status
     * of an existing usermanagement record.
     */
    public ManagedUserDto updateManagedUser(String employeeId, ManagedUserDto dto,
                                            String callerEmployeeId, UserRole callerRole) {

        ManagedUserDto existingDto = userRepository.findManagedUserById(employeeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "User '" + employeeId + "' not found."));

        if (callerRole == UserRole.REGIONAL_ADMIN) {
            assertRegionalOwnsTargetUser(existingDto, callerEmployeeId);
            if (!isReceptionistOnlyAccount(employeeId)) {
                throw new UnauthorizedOperationException(
                        "You can only manage Receptionist accounts you created.");
            }
        }

        UserStatus status = dto.isStatus() ? UserStatus.ACTIVE : UserStatus.INACTIVE;
        List<Integer> roleIds = normalizeRoleIds(dto);
        int primaryRoleId = AuthorizationHelper.primaryRoleId(roleIds);

        if (callerRole == UserRole.REGIONAL_ADMIN && !isReceptionistOnlyRoleIds(roleIds)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "You cannot change this account to a non-Receptionist role.");
        }

        List<ResolvedLocation> locs = resolveLocationsForRoleIds(roleIds, dto);
        String assignedDeviceId = resolveAssignedDeviceId(roleIds, dto.getAssignedDeviceId(),
                callerEmployeeId, callerRole);
        ResolvedLocation primaryLoc = resolvePrimaryLocation(locs, assignedDeviceId);

        String workEmail = StringUtils.hasText(dto.getWorkEmail()) ? dto.getWorkEmail().trim() : "";
        String phone     = StringUtils.hasText(dto.getPhone())     ? dto.getPhone().trim()     : "";
        String designation = StringUtils.hasText(dto.getDesignation()) ? dto.getDesignation().trim() : "Employee";
        String department  = StringUtils.hasText(dto.getDepartment())  ? dto.getDepartment().trim()  : "General";

        userRepository.updateUserManagement(
                employeeId,
                dto.getName().trim(),
                primaryLoc.code(),
                primaryLoc.name(),
                assignedDeviceId,
                status,
                primaryRoleId,
                callerEmployeeId,
                workEmail,
                phone,
                designation,
                department
        );
        userRepository.replaceUserRoles(employeeId, roleIds);
        userRepository.replaceUserLocations(employeeId,
                locs.stream().map(ResolvedLocation::code).toList());

        // Only update the password if the admin explicitly supplied a new one.
        if (dto.getPassword() != null && !dto.getPassword().isBlank()) {
            String encoded = passwordEncoder.encode(dto.getPassword());
            userRepository.updatePassword(employeeId, encoded, callerEmployeeId);
            log.info("[UserManagement] Password changed for: {} by {}", employeeId, callerEmployeeId);
        }

        log.info("[UserManagement] Updated: {} roles={} locations={} by {}", employeeId, roleIds,
                locs.stream().map(ResolvedLocation::code).toList(), callerEmployeeId);

        ManagedUserDto updated = userRepository.findManagedUserById(employeeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "User was updated but could not be retrieved."));
        enrichRoleMappings(List.of(updated));
        return updated;
    }

    // ── Status toggle ─────────────────────────────────────────────────────────

    public ManagedUserDto updateManagedUserStatus(String employeeId, boolean active,
                                                  String callerEmployeeId, UserRole callerRole) {

        ManagedUserDto existingDto = userRepository.findManagedUserById(employeeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "User '" + employeeId + "' not found."));

        if (callerRole == UserRole.REGIONAL_ADMIN) {
            assertRegionalOwnsTargetUser(existingDto, callerEmployeeId);
            if (!isReceptionistOnlyAccount(employeeId)) {
                throw new UnauthorizedOperationException(
                        "You can only change status for Receptionist accounts you created.");
            }
        }

        UserStatus status = active ? UserStatus.ACTIVE : UserStatus.INACTIVE;
        userRepository.updateUserManagementStatus(employeeId, status, callerEmployeeId);
        log.info("[UserManagement] Status updated: {} → {} by {}", employeeId, status, callerEmployeeId);

        return userRepository.findManagedUserById(employeeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "Status was updated but user could not be retrieved."));
    }

    // ── Temporary device access ───────────────────────────────────────────────

    public TempDeviceGrantDto grantTempDeviceAccess(String targetEmployeeId,
                                                    TempDeviceGrantRequestDto request,
                                                    String callerEmployeeId,
                                                    String callerRole) {
        UserManagement target = userRepository.findByEmployeeId(targetEmployeeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "User not found: " + targetEmployeeId));

        validateDevicePermission(callerRole, callerEmployeeId, target);

        if (!userRepository.hasRole(targetEmployeeId, 3)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Temporary desk access applies to Receptionist accounts only.");
        }

        String deviceId = resolveGrantDeviceId(request);
        deviceMasterService.getById(deviceId);

        String reason = request.getReason() != null ? request.getReason().trim() : "";
        if (reason.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Reason is required.");
        }

        LocalDateTime expiresAt = resolveGrantExpiry(request);
        if (!expiresAt.isAfter(LocalDateTime.now(IST))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Expiry must be in the future.");
        }

        userDeviceGrantRepository.revokeActiveForEmployee(targetEmployeeId, callerEmployeeId);
        long grantId = userDeviceGrantRepository.insert(
                targetEmployeeId, deviceId, expiresAt, callerEmployeeId, reason);

        log.info("DEVICE GRANT id={} for {} device={} until {} | by {} | reason: {}",
                grantId, targetEmployeeId, deviceId, expiresAt, callerEmployeeId, reason);

        return userDeviceGrantRepository.findById(grantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "Grant created but could not be retrieved."));
    }

    public TempDeviceGrantDto revokeTempDeviceAccess(String targetEmployeeId,
                                                     String callerEmployeeId,
                                                     String callerRole) {
        UserManagement target = userRepository.findByEmployeeId(targetEmployeeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "User not found: " + targetEmployeeId));

        validateDevicePermission(callerRole, callerEmployeeId, target);

        TempDeviceGrantDto active = userDeviceGrantRepository.findActiveByEmployee(targetEmployeeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "No active temporary access grant for this user."));

        userDeviceGrantRepository.revokeActiveForEmployee(targetEmployeeId, callerEmployeeId);

        log.info("DEVICE GRANT revoked for {} | by {}", targetEmployeeId, callerEmployeeId);

        return TempDeviceGrantDto.builder()
                .id(active.getId())
                .employeeId(active.getEmployeeId())
                .employeeName(active.getEmployeeName())
                .deviceId(active.getDeviceId())
                .deviceName(active.getDeviceName())
                .macAddress(active.getMacAddress())
                .expiresAt(active.getExpiresAt())
                .grantedBy(active.getGrantedBy())
                .reason(active.getReason())
                .status("REVOKED")
                .revokedBy(callerEmployeeId)
                .revokedAt(LocalDateTime.now(IST))
                .createdAt(active.getCreatedAt())
                .build();
    }

    public TempDeviceGrantDto getActiveTempDeviceGrant(String targetEmployeeId) {
        return userDeviceGrantRepository.findActiveByEmployee(targetEmployeeId)
                .orElse(null);
    }

    public List<TempDeviceGrantDto> getTempDeviceGrantHistory(String targetEmployeeId, int limit) {
        if (limit <= 0 || limit > 50) {
            limit = 20;
        }
        return userDeviceGrantRepository.findHistoryByEmployee(targetEmployeeId, limit);
    }

    private String resolveGrantDeviceId(TempDeviceGrantRequestDto request) {
        if (request.getDeviceId() != null && !request.getDeviceId().isBlank()) {
            return request.getDeviceId().trim();
        }

        String mac = resolveGrantMac(request);
        if (!WorkstationMacUtil.normalize(mac).isEmpty()) {
            return deviceMasterService.resolveByMac(mac)
                    .map(d -> d.getDeviceId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "No registered kiosk found for MAC " + mac
                                    + ". Add the device in Device Master first."));
        }

        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "A registered kiosk (deviceId) is required.");
    }

    private String resolveGrantMac(TempDeviceGrantRequestDto request) {
        String absentId = firstNonBlank(request.getAbsentEmployeeId(), request.getCopyMacFromEmployeeId());
        if (absentId != null) {
            UserManagement source = userRepository.findByEmployeeId(absentId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Absent user not found: " + absentId));
            if (!userRepository.hasRole(absentId, 3)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Absent user must be a Receptionist with an assigned kiosk.");
            }
            String assignedDeviceId = source.getAssignedDeviceId();
            if (assignedDeviceId == null || assignedDeviceId.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Absent user has no assigned kiosk. Set it in User Management first.");
            }
            DeviceMasterDto device = deviceMasterService.getById(assignedDeviceId.trim());
            if (device.getMacAddress() == null || device.getMacAddress().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Assigned kiosk has no MAC. Update the device in Device Master.");
            }
            return device.getMacAddress();
        }
        return request.getMacAddress();
    }

    private static String firstNonBlank(String... values) {
        if (values == null) return null;
        for (String v : values) {
            if (v != null && !v.isBlank()) return v.trim();
        }
        return null;
    }

    private LocalDateTime resolveGrantExpiry(TempDeviceGrantRequestDto request) {
        if (request.getExpiresAt() != null) {
            return request.getExpiresAt();
        }
        int hours = request.getDurationHours() != null && request.getDurationHours() > 0
                ? request.getDurationHours() : 8;
        return LocalDateTime.now(IST).plusHours(hours);
    }

    // ── Password management ───────────────────────────────────────────────────

    /**
     * Resets a user's password to their Employee ID in ALL CAPS.
     * Only ADMIN and SUPERVISOR (for receptionists only) can perform this.
     */
    public void resetPassword(String targetEmployeeId, String callerEmployeeId, String callerRole) {
        UserManagement target = userRepository.findByEmployeeId(targetEmployeeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "User not found: " + targetEmployeeId));

        validateDevicePermission(callerRole, callerEmployeeId, target);

        String rawPassword = targetEmployeeId.toUpperCase();
        String encoded     = passwordEncoder.encode(rawPassword);
        userRepository.updatePassword(targetEmployeeId, encoded, callerEmployeeId);

        log.info("[Password] RESET for: {} (→ ID in caps) | by: {} ({})",
                targetEmployeeId, callerEmployeeId, callerRole);
    }

    /**
     * Allows a user to change their own password.
     * Verifies the current password before applying the new one.
     */
    public void changePassword(String employeeId, String currentPassword, String newPassword) {
        UserManagement user = userRepository.findByEmployeeId(employeeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "User not found."));

        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Current password is incorrect.");
        }
        if (newPassword == null || newPassword.length() < 4) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "New password must be at least 4 characters.");
        }

        String encoded = passwordEncoder.encode(newPassword);
        userRepository.updatePassword(employeeId, encoded, employeeId);

        log.info("[Password] CHANGED for: {}", employeeId);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Resolves one or more locations for supervisors (role id 2).
     * Primary location is the first entry; all are stored in {@code user_location_mapping}.
     */
    private List<ResolvedLocation> resolveLocationsForRoleIds(List<Integer> roleIds, ManagedUserDto dto) {
        if (!roleIds.contains(2)) {
            return List.of();
        }
        LinkedHashSet<String> inputs = new LinkedHashSet<>();
        if (dto.getLocationIds() != null) {
            dto.getLocationIds().stream()
                    .filter(StringUtils::hasText)
                    .map(String::trim)
                    .forEach(inputs::add);
        }
        if (inputs.isEmpty() && StringUtils.hasText(dto.getLocation())) {
            inputs.add(dto.getLocation().trim());
        }
        if (inputs.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "At least one location is required for supervisors.");
        }
        List<ResolvedLocation> out = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (String input : inputs) {
            ResolvedLocation loc = resolveLocation(input);
            if (seen.add(loc.code().toLowerCase())) {
                out.add(loc);
            }
        }
        return out;
    }

    /** Resolves typed location to code + display name; unknown values become new ad-hoc locations. */
    private ResolvedLocation resolveLocation(String locationInput) {
        String trimmed = locationInput != null ? locationInput.trim() : "";
        if (trimmed.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Location is required.");
        }
        String code = userRepository.findLocationIdByNameOrCode(trimmed).orElse(trimmed);
        String name = userRepository.findLocationName(code).orElse(trimmed);
        return new ResolvedLocation(code, name);
    }

    private record ResolvedLocation(String code, String name) {}

    /** Supervisor locations, else site of assigned kiosk (receptionists). */
    private ResolvedLocation resolvePrimaryLocation(List<ResolvedLocation> locs, String assignedDeviceId) {
        if (locs != null && !locs.isEmpty()) {
            return locs.get(0);
        }
        if (StringUtils.hasText(assignedDeviceId)) {
            DeviceMasterDto device = deviceMasterService.getById(assignedDeviceId.trim());
            String code = device.getLocationId() != null ? device.getLocationId().trim() : "";
            if (StringUtils.hasText(code)) {
                String name = StringUtils.hasText(device.getLocationName())
                        ? device.getLocationName().trim()
                        : userRepository.findLocationName(code).orElse(code);
                return new ResolvedLocation(code, name);
            }
        }
        return new ResolvedLocation("", "");
    }

    /**
     * Receptionists must be linked to an active kiosk in Device Master.
     * Other roles do not use assigned devices.
     */
    private String resolveAssignedDeviceId(List<Integer> roleIds, String input,
                                         String callerEmployeeId, UserRole callerRole) {
        if (!roleIds.contains(3)) {
            return null;
        }
        if (input == null || input.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Assigned kiosk is required for receptionists.");
        }
        String deviceId = input.trim();
        DeviceMasterDto device = deviceMasterService.getById(deviceId);
        if (!device.isActive()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Selected kiosk is inactive. Choose an active device or activate it in Device Master.");
        }
        if (callerRole == UserRole.REGIONAL_ADMIN) {
            if (!userRepository.hasLocationAccess(callerEmployeeId, device.getLocationId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "You can only assign kiosks at your assigned locations.");
            }
        }
        return deviceId;
    }

    private static boolean isPrimaryAdmin(Authentication auth) {
        return auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_PRIMARY_ADMIN".equals(a.getAuthority()));
    }

    private static boolean isRegionalAdmin(Authentication auth) {
        return auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_REGIONAL_ADMIN".equals(a.getAuthority()));
    }

    /** Regional admin may only manage users they provisioned (createdBy match). */
    private static void assertRegionalOwnsTargetUser(ManagedUserDto target, String callerEmployeeId) {
        String by = target.getCreatedBy();
        if (by == null || by.isBlank() || "SYSTEM".equalsIgnoreCase(by.trim())) {
            throw new UnauthorizedOperationException(
                    "You can only manage Receptionist accounts that you created.");
        }
        if (!by.trim().equalsIgnoreCase(callerEmployeeId.trim())) {
            throw new UnauthorizedOperationException(
                    "You can only manage users you created.");
        }
    }

    private void validateDevicePermission(String callerRole, String callerEmployeeId,
                                          UserManagement target) {
        List<Integer> targetRoles = userRepository.findRoleIdsByEmployeeId(target.getEmployeeid());
        UserRole callerUserRole = UserRole.valueOf(callerRole);
        switch (callerUserRole) {
            case PRIMARY_ADMIN -> {
                if (targetRoles.contains(1) && !callerEmployeeId.equals(target.getEmployeeid())) {
                    throw new UnauthorizedOperationException(
                            "Admin cannot update another Admin's device. Contact the system owner.");
                }
            }
            case REGIONAL_ADMIN -> {
                if (!isReceptionistOnlyRoleIds(targetRoles)) {
                    throw new UnauthorizedOperationException(
                            "Supervisors can only update device access for Receptionists.");
                }
                assertRegionalOwnsTargetUser(
                        userRepository.findManagedUserById(target.getEmployeeid()).orElseThrow(),
                        callerEmployeeId);
            }
            default -> throw new UnauthorizedOperationException(
                    "You do not have permission to perform this operation.");
        }
    }

    private List<Integer> normalizeRoleIds(ManagedUserDto dto) {
        Set<Integer> ids = new LinkedHashSet<>();
        if (dto.getRoleIds() != null) {
            dto.getRoleIds().stream()
                    .filter(id -> id != null && id > 0)
                    .forEach(ids::add);
        }
        if (ids.isEmpty() && dto.getRoleId() != null && dto.getRoleId() > 0) {
            ids.add(dto.getRoleId());
        }
        if (ids.isEmpty()) {
            ids.add(3);
        }
        return new ArrayList<>(ids);
    }

    private boolean isReceptionistOnlyRoleIds(List<Integer> roleIds) {
        return roleIds != null && roleIds.size() == 1 && roleIds.get(0) == 3;
    }

    private boolean isReceptionistOnlyAccount(String employeeId) {
        return isReceptionistOnlyRoleIds(userRepository.findRoleIdsByEmployeeId(employeeId));
    }

    private void enrichRoleMappings(List<ManagedUserDto> rows) {
        if (rows == null || rows.isEmpty()) {
            return;
        }
        List<String> ids = rows.stream().map(ManagedUserDto::getId).toList();
        var roleMap = userRepository.findRoleIdsByEmployeeIds(ids);
        var locMap = userRepository.findLocationIdsByEmployeeIds(ids);
        for (ManagedUserDto row : rows) {
            List<Integer> roleIds = roleMap.getOrDefault(row.getId(), List.of(3));
            row.setRoleIds(roleIds);
            row.setRoleId(AuthorizationHelper.primaryRoleId(roleIds));
            row.setRoleName(userRepository.formatRoleNames(roleIds));

            List<String> locationIds = locMap.getOrDefault(row.getId(), List.of());
            row.setLocationIds(locationIds);
            if (!locationIds.isEmpty()) {
                row.setLocation(userRepository.formatLocationNames(locationIds));
            }
        }
    }
}
