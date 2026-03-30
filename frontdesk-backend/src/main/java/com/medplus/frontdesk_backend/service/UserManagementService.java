package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.dto.DeviceResetRequestDto;
import com.medplus.frontdesk_backend.dto.DeviceResetResponseDto;
import com.medplus.frontdesk_backend.exception.InvalidCredentialsException;
import com.medplus.frontdesk_backend.exception.UnauthorizedOperationException;
import com.medplus.frontdesk_backend.model.UserManagement;
import com.medplus.frontdesk_backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserManagementService {

    private final UserRepository userRepository;

    /**
     * Updates the MAC address of a target user to the new value provided.
     * newMacAddress is mandatory — validated at the DTO level before reaching here.
     *
     * Permission rules:
     *  - PRIMARY_ADMIN  → can update MAC for REGIONAL_ADMIN or RECEPTIONIST
     *  - REGIONAL_ADMIN → can only update MAC for RECEPTIONIST users
     *  - RECEPTIONIST   → no access (blocked at controller via @PreAuthorize)
     */
    public DeviceResetResponseDto resetDeviceMac(String targetEmployeeId,
                                                  DeviceResetRequestDto request,
                                                  String callerEmployeeId,
                                                  String callerRole) {

        // ── Fetch target user ─────────────────────────────────────────────────
        UserManagement target = userRepository.findByEmployeeId(targetEmployeeId)
                .orElseThrow(() -> new InvalidCredentialsException(
                        "User not found: " + targetEmployeeId));

        // ── Enforce role hierarchy ────────────────────────────────────────────
        validatePermission(callerRole, callerEmployeeId, target);

        // ── Persist new MAC ───────────────────────────────────────────────────
        String newMac = request.getNewMacAddress().trim();
        userRepository.updateMacAddress(targetEmployeeId, newMac);

        log.info("MAC address UPDATED for employeeId: {} → {} | by: {} ({}) | reason: {}",
                targetEmployeeId, newMac, callerEmployeeId, callerRole, request.getReason());

        return DeviceResetResponseDto.builder()
                .employeeId(targetEmployeeId)
                .macAddress(newMac)
                .performedBy(callerEmployeeId)
                .reason(request.getReason())
                .build();
    }

    // ── Permission guard ──────────────────────────────────────────────────────

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
