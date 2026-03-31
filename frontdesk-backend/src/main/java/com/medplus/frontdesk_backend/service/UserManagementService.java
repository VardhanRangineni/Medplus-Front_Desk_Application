package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.dto.DeviceResetRequestDto;
import com.medplus.frontdesk_backend.dto.DeviceResetResponseDto;
import com.medplus.frontdesk_backend.dto.ManagedUserDto;
import com.medplus.frontdesk_backend.dto.UserLookupDto;
import com.medplus.frontdesk_backend.exception.InvalidCredentialsException;
import com.medplus.frontdesk_backend.exception.UnauthorizedOperationException;
import com.medplus.frontdesk_backend.model.UserManagement;
import com.medplus.frontdesk_backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserManagementService {

    private final UserRepository         userRepository;
    private final BCryptPasswordEncoder  passwordEncoder;

    // ── List ──────────────────────────────────────────────────────────────────

    public List<ManagedUserDto> getManagedUsers() {
        return userRepository.findAllManagedUsers();
    }

    // ── Search / Lookup ───────────────────────────────────────────────────────

    /**
     * Type-ahead search over usermaster by employeeid or fullName.
     * Returns an empty list if the query is blank.
     */
    public List<UserLookupDto> searchUsers(String query) {
        if (query == null || query.isBlank()) return List.of();
        return userRepository.searchUserMaster(query);
    }

    // ── Create ────────────────────────────────────────────────────────────────

    /**
     * Creates a new usermanagement record (and a minimal usermaster record if absent).
     *
     * Default role     : RECEPTIONIST
     * Default password : BCrypt(employeeId)
     */
    public ManagedUserDto createManagedUser(ManagedUserDto dto) {

        String employeeId = dto.getId().trim();

        if (userRepository.existsInUserManagement(employeeId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "User '" + employeeId + "' already exists in the system.");
        }

        String locationId = resolveLocationId(dto.getLocation());

        // Create a minimal usermaster entry if this employee isn't in the system yet
        if (!userRepository.existsInUserMaster(employeeId)) {
            userRepository.insertUserMaster(
                    employeeId,
                    dto.getName().trim(),
                    employeeId.toLowerCase() + "@medplus.com",
                    "0000000000",
                    "Employee",
                    dto.getLocation().trim(),
                    "General",
                    null
            );
        }

        // Use the admin-supplied password if provided; otherwise default to the employee ID.
        String rawPassword = (dto.getPassword() != null && !dto.getPassword().isBlank())
                ? dto.getPassword()
                : employeeId;
        String encoded = passwordEncoder.encode(rawPassword);
        String status  = dto.isStatus() ? "ACTIVE" : "INACTIVE";

        userRepository.insertUserManagement(
                employeeId,
                dto.getName().trim(),
                encoded,
                locationId,
                status,
                "RECEPTIONIST",
                dto.getIpAddress() != null ? dto.getIpAddress().trim() : "0.0.0.0"
        );

        log.info("[UserManagement] Created: {} ({})", employeeId, dto.getName());

        return userRepository.findManagedUserById(employeeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "User was created but could not be retrieved."));
    }

    // ── Update ────────────────────────────────────────────────────────────────

    /**
     * Updates name, location, IP address, MAC address, and status
     * of an existing usermanagement record.
     */
    public ManagedUserDto updateManagedUser(String employeeId, ManagedUserDto dto) {

        if (!userRepository.existsInUserManagement(employeeId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "User '" + employeeId + "' not found.");
        }

        String locationId = resolveLocationId(dto.getLocation());
        String status     = dto.isStatus() ? "ACTIVE" : "INACTIVE";

        userRepository.updateUserManagement(
                employeeId,
                dto.getName().trim(),
                locationId,
                dto.getIpAddress()  != null ? dto.getIpAddress().trim()  : "0.0.0.0",
                dto.getMacAddress() != null ? dto.getMacAddress().trim()  : null,
                status
        );

        // Only update the password if the admin explicitly supplied a new one.
        if (dto.getPassword() != null && !dto.getPassword().isBlank()) {
            String encoded = passwordEncoder.encode(dto.getPassword());
            userRepository.updatePassword(employeeId, encoded);
            log.info("[UserManagement] Password changed for: {}", employeeId);
        }

        log.info("[UserManagement] Updated: {}", employeeId);

        return userRepository.findManagedUserById(employeeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "User was updated but could not be retrieved."));
    }

    // ── Status toggle ─────────────────────────────────────────────────────────

    public ManagedUserDto updateManagedUserStatus(String employeeId, boolean active) {

        if (!userRepository.existsInUserManagement(employeeId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "User '" + employeeId + "' not found.");
        }

        String status = active ? "ACTIVE" : "INACTIVE";
        userRepository.updateUserManagementStatus(employeeId, status);
        log.info("[UserManagement] Status updated: {} → {}", employeeId, status);

        return userRepository.findManagedUserById(employeeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "Status was updated but user could not be retrieved."));
    }

    // ── MAC reset ─────────────────────────────────────────────────────────────

    /**
     * Updates the MAC address of a target user to the new value provided.
     *
     * Permission rules:
     *  - PRIMARY_ADMIN  → can update MAC for REGIONAL_ADMIN or RECEPTIONIST
     *  - REGIONAL_ADMIN → can only update MAC for RECEPTIONIST users
     */
    public DeviceResetResponseDto resetDeviceMac(String targetEmployeeId,
                                                  DeviceResetRequestDto request,
                                                  String callerEmployeeId,
                                                  String callerRole) {

        UserManagement target = userRepository.findByEmployeeId(targetEmployeeId)
                .orElseThrow(() -> new InvalidCredentialsException(
                        "User not found: " + targetEmployeeId));

        validatePermission(callerRole, callerEmployeeId, target);

        String newMac = request.getNewMacAddress().trim();
        userRepository.updateMacAddress(targetEmployeeId, newMac);

        log.info("MAC UPDATED for: {} → {} | by: {} ({}) | reason: {}",
                targetEmployeeId, newMac, callerEmployeeId, callerRole, request.getReason());

        return DeviceResetResponseDto.builder()
                .employeeId(targetEmployeeId)
                .macAddress(newMac)
                .performedBy(callerEmployeeId)
                .reason(request.getReason())
                .build();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Resolves a location descriptive name OR LocationId to the LocationId FK.
     * Throws 400 if not found.
     */
    private String resolveLocationId(String locationNameOrCode) {
        return userRepository.findLocationIdByNameOrCode(locationNameOrCode)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Location '" + locationNameOrCode + "' not found. " +
                        "Use the exact location name or code from the Location Master."));
    }

    private void validatePermission(String callerRole, String callerEmployeeId,
                                     UserManagement target) {
        String targetRole = target.getRole();
        switch (callerRole) {
            case "PRIMARY_ADMIN" -> {
                if ("PRIMARY_ADMIN".equals(targetRole) && !callerEmployeeId.equals(target.getEmployeeid())) {
                    throw new UnauthorizedOperationException(
                            "Admin cannot update another Admin's device. Contact the system owner.");
                }
            }
            case "REGIONAL_ADMIN" -> {
                if (!"RECEPTIONIST".equals(targetRole)) {
                    throw new UnauthorizedOperationException(
                            "Supervisors can only update device access for Receptionists.");
                }
            }
            default -> throw new UnauthorizedOperationException(
                    "You do not have permission to perform this operation.");
        }
    }
}
