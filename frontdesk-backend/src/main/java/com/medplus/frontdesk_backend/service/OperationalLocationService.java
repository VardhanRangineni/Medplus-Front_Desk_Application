package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.dto.DeviceMasterDto;
import com.medplus.frontdesk_backend.model.UserManagement;
import com.medplus.frontdesk_backend.model.UserRole;
import com.medplus.frontdesk_backend.repository.TempDeviceGrantRepository;
import com.medplus.frontdesk_backend.repository.UserDeviceGrantRepository;
import com.medplus.frontdesk_backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

/**
 * Resolves which desk / location applies to the current request.
 *
 * <p>When the operator has an <strong>assigned kiosk</strong>, that desk is the
 * operational identity for check-in (admins with Receptionist + assigned desk,
 * receptionists on their home desk). Physical MAC wins only when it matches the
 * assigned kiosk or an active temp/device grant (covering another desk).
 */
@Service
@RequiredArgsConstructor
public class OperationalLocationService {

    private final UserRepository userRepository;
    private final DeviceMasterService deviceMasterService;
    private final TempDeviceGrantRepository tempDeviceGrantRepository;
    private final UserDeviceGrantRepository userDeviceGrantRepository;

    public String resolveForUser(String employeeId, String workstationMac) {
        return resolveDeskDevice(employeeId, workstationMac)
                .map(DeviceMasterDto::getLocationId)
                .filter(StringUtils::hasText)
                .orElseGet(() -> fallbackLocation(employeeId, workstationMac));
    }

    /**
     * Desk used for check-in / session display.
     * Prefer assigned kiosk; use MAC only when it is that kiosk or an active grant.
     */
    public Optional<DeviceMasterDto> resolveDeskDevice(String employeeId, String workstationMac) {
        UserManagement user = userRepository.findByEmployeeId(employeeId).orElse(null);
        Optional<DeviceMasterDto> macDevice = resolveMacDevice(workstationMac);

        if (user == null) {
            return macDevice;
        }

        Optional<DeviceMasterDto> assignedDevice = resolveAssignedDevice(user);

        if (macDevice.isPresent()) {
            DeviceMasterDto mac = macDevice.get();
            if (assignedDevice.isPresent()
                    && idsMatch(assignedDevice.get().getDeviceId(), mac.getDeviceId())) {
                return assignedDevice;
            }
            if (hasActiveGrantOnDevice(employeeId, workstationMac, mac.getDeviceId())) {
                return macDevice;
            }
            // Non-receptionist elevated users without an assigned desk: physical PC.
            if (assignedDevice.isEmpty() && !userRepository.hasRole(employeeId, 3)) {
                return macDevice;
            }
        }

        if (assignedDevice.isPresent()) {
            return assignedDevice;
        }

        return macDevice;
    }

    private String fallbackLocation(String employeeId, String workstationMac) {
        UserManagement user = userRepository.findByEmployeeId(employeeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                        "User not found in management records: " + employeeId));

        if (user.getRole() == UserRole.RECEPTIONIST
                || userRepository.hasRole(employeeId, 3)) {
            return resolveFromDevice(workstationMac);
        }

        return profileLocation(user);
    }

    public String resolveFromDevice(String workstationMac) {
        if (!StringUtils.hasText(workstationMac)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Could not determine location. Sign in from a registered kiosk.");
        }
        DeviceMasterDto device = deviceMasterService.resolveByMac(workstationMac)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "This kiosk is not registered. Contact your administrator."));
        if (!device.isActive()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "This kiosk is inactive. Contact your administrator.");
        }
        return device.getLocationId();
    }

    private Optional<DeviceMasterDto> resolveMacDevice(String workstationMac) {
        if (!StringUtils.hasText(workstationMac)) {
            return Optional.empty();
        }
        return deviceMasterService.resolveByMac(workstationMac)
                .filter(DeviceMasterDto::isActive);
    }

    private Optional<DeviceMasterDto> resolveAssignedDevice(UserManagement user) {
        String assignedId = user.getAssignedDeviceId();
        if (!StringUtils.hasText(assignedId)) {
            return Optional.empty();
        }
        try {
            DeviceMasterDto device = deviceMasterService.getById(assignedId.trim());
            if (device != null && device.isActive()) {
                return Optional.of(device);
            }
        } catch (ResponseStatusException ex) {
            // assigned id missing from master — fall through
        }
        return Optional.empty();
    }

    private boolean hasActiveGrantOnDevice(String employeeId, String workstationMac, String deviceId) {
        if (StringUtils.hasText(workstationMac)
                && tempDeviceGrantRepository.findActiveByEmployeeAndMac(employeeId, workstationMac).isPresent()) {
            return true;
        }
        return StringUtils.hasText(deviceId)
                && userDeviceGrantRepository.hasActiveGrant(employeeId, deviceId);
    }

    private static boolean idsMatch(String a, String b) {
        return StringUtils.hasText(a) && StringUtils.hasText(b)
                && a.trim().equalsIgnoreCase(b.trim());
    }

    private static String profileLocation(UserManagement user) {
        String location = user.getLocation();
        if (!StringUtils.hasText(location)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "User has no assigned location.");
        }
        return location.trim();
    }
}
