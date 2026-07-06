package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.config.DeviceAuthMode;
import com.medplus.frontdesk_backend.dto.DeviceMasterDto;
import com.medplus.frontdesk_backend.dto.LoginRequestDto;
import com.medplus.frontdesk_backend.dto.LoginResponseDto;
import com.medplus.frontdesk_backend.exception.AccountInactiveException;
import com.medplus.frontdesk_backend.exception.DeviceNotAuthorizedException;
import com.medplus.frontdesk_backend.exception.InvalidCredentialsException;
import com.medplus.frontdesk_backend.model.UserManagement;
import com.medplus.frontdesk_backend.model.UserRole;
import com.medplus.frontdesk_backend.model.UserStatus;
import com.medplus.frontdesk_backend.model.UserRole;
import com.medplus.frontdesk_backend.model.UserStatus;
import com.medplus.frontdesk_backend.repository.TempDeviceGrantRepository;
import com.medplus.frontdesk_backend.repository.UserDeviceGrantRepository;
import com.medplus.frontdesk_backend.repository.UserRepository;
import com.medplus.frontdesk_backend.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final TempDeviceGrantRepository tempDeviceGrantRepository;
    private final UserDeviceGrantRepository userDeviceGrantRepository;
    private final DeviceMasterService deviceMasterService;
    private final OperationalLocationService operationalLocationService;
    private final BCryptPasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    @Value("${jwt.expiration}")
    private long jwtExpirationMs;

    /** Registered kiosk first, legacy MAC fallback for non-receptionists. */
    private static final DeviceAuthMode DEVICE_AUTH_MODE = DeviceAuthMode.HYBRID;
    /** Receptionists must sign in from their assigned kiosk (or an active temp grant). */
    private static final boolean ENFORCE_ASSIGNED_DEVICE = true;

    public LoginResponseDto login(LoginRequestDto request) {
        log.debug("Login attempt for employeeId: {} from IP: {}", request.getEmployeeId(), request.getIpAddress());

        UserManagement user = userRepository.findByEmployeeId(request.getEmployeeId())
                .orElseThrow(() -> new InvalidCredentialsException("Invalid employee ID or password"));

        if (user.getStatus() == UserStatus.INACTIVE) {
            throw new AccountInactiveException(
                    "Your account is inactive. Please contact your administrator.");
        }

        if (!user.isLoginEnabled()) {
            throw new InvalidCredentialsException("Invalid employee ID or password");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            log.warn("Invalid password for employeeId: {}", request.getEmployeeId());
            throw new InvalidCredentialsException("Invalid employee ID or password");
        }

        String incomingIp  = nullToEmpty(request.getIpAddress());
        String incomingMac = nullToEmpty(request.getMacAddress());
        DeviceAuthMode mode = DEVICE_AUTH_MODE;

        List<UserRole> assignedRoles = user.getRoles() != null && !user.getRoles().isEmpty()
                ? user.getRoles()
                : List.of(user.getRole() != null ? user.getRole() : UserRole.RECEPTIONIST);
        boolean hasElevatedRole = assignedRoles.contains(UserRole.PRIMARY_ADMIN)
                || assignedRoles.contains(UserRole.REGIONAL_ADMIN);

        DeviceMasterDto sessionDevice;

        if (hasElevatedRole) {
            log.info("Elevated-role login — device check skipped for employeeId: {}", user.getEmployeeid());
            // Prefer assigned kiosk (desk identity) over whatever PC MAC maps to.
            sessionDevice = operationalLocationService
                    .resolveDeskDevice(user.getEmployeeid(), incomingMac)
                    .orElseGet(() -> resolveDeviceIfPresent(incomingMac, incomingIp));
            if (sessionDevice != null && StringUtils.hasText(incomingIp)) {
                deviceMasterService.touchLastKnownIp(sessionDevice.getDeviceId(), incomingIp);
            }
        } else {
            sessionDevice = authorizeWorkstation(user, incomingIp, incomingMac, mode, assignedRoles);
        }

        UserRole primaryRole = user.getRole() != null ? user.getRole() : UserRole.RECEPTIONIST;
        List<String> roleNames = assignedRoles.stream().map(UserRole::name).distinct().toList();

        String token = jwtTokenProvider.generateToken(user.getEmployeeid(), primaryRole.name());

        List<String> assignedLocationIds = userRepository.findLocationIdsByEmployeeId(user.getEmployeeid());
        final String sessionLocationId;
        final String sessionLocationName;
        if (sessionDevice != null) {
            String deviceLocId = sessionDevice.getLocationId();
            boolean deviceAllowed = assignedLocationIds.isEmpty()
                    || assignedLocationIds.stream().anyMatch(id -> id.equalsIgnoreCase(deviceLocId));
            if (deviceAllowed) {
                sessionLocationId = deviceLocId;
                sessionLocationName = sessionDevice.getLocationName() != null
                        ? sessionDevice.getLocationName()
                        : userRepository.findLocationName(deviceLocId).orElse(deviceLocId);
            } else if (!assignedLocationIds.isEmpty()) {
                sessionLocationId = assignedLocationIds.get(0);
                sessionLocationName = userRepository.findLocationName(sessionLocationId)
                        .orElse(sessionLocationId);
            } else {
                sessionLocationId = user.getLocation();
                sessionLocationName = userRepository.findLocationName(
                                sessionLocationId != null ? sessionLocationId : "")
                        .orElse(sessionLocationId != null ? sessionLocationId : "");
            }
        } else if (!assignedLocationIds.isEmpty()) {
            sessionLocationId = assignedLocationIds.get(0);
            sessionLocationName = userRepository.findLocationName(sessionLocationId)
                    .orElse(sessionLocationId);
        } else {
            sessionLocationId = user.getLocation();
            sessionLocationName = userRepository.findLocationName(
                            sessionLocationId != null ? sessionLocationId : "")
                    .orElse(sessionLocationId != null ? sessionLocationId : "");
        }

        log.info("Successful login — employeeId: {}, roles: {}, locations: {}, IP: {}, MAC: {}, device: {}",
                user.getEmployeeid(), roleNames, assignedLocationIds, incomingIp, incomingMac,
                sessionDevice != null ? sessionDevice.getDeviceId() : "none");

        return LoginResponseDto.builder()
                .token(token)
                .tokenType("Bearer")
                .employeeId(user.getEmployeeid())
                .role(primaryRole.name())
                .roles(roleNames)
                .fullName(user.getFullName())
                .locationId(sessionLocationId)
                .locationName(sessionLocationName)
                .locationIds(assignedLocationIds)
                .deviceId(sessionDevice != null ? sessionDevice.getDeviceId() : null)
                .deviceName(sessionDevice != null ? sessionDevice.getDisplayName() : null)
                .expiresIn(jwtExpirationMs / 1000)
                .build();
    }

    private DeviceMasterDto authorizeWorkstation(UserManagement user, String incomingIp,
                                                   String incomingMac, DeviceAuthMode mode,
                                                   List<UserRole> assignedRoles) {
        boolean isReceptionist = assignedRoles.contains(UserRole.RECEPTIONIST);
        boolean isRegionalOnly = assignedRoles.contains(UserRole.REGIONAL_ADMIN) && !isReceptionist;

        if (mode != DeviceAuthMode.LEGACY) {
            Optional<DeviceMasterDto> deviceOpt = deviceMasterService.resolveByMac(incomingMac);
            if (deviceOpt.isPresent()) {
                DeviceMasterDto device = deviceOpt.get();
                if (!device.isActive()) {
                    throw new DeviceNotAuthorizedException(
                            "This kiosk is inactive. Contact your administrator.");
                }
                if (!isReceptionist && isRegionalOnly
                        && !locationsMatch(device.getLocationId(), user.getLocation())) {
                    throw new DeviceNotAuthorizedException(
                            "This kiosk belongs to a different location than your account.");
                }
                if (isReceptionist
                        && !isReceptionistAllowedOnDevice(user, device)) {
                    throw receptionistDeviceDenied(user, device);
                }
                if (StringUtils.hasText(device.getIpAddress())
                        && !"0.0.0.0".equals(device.getIpAddress())
                        && !device.getIpAddress().equals(incomingIp)) {
                    throw new DeviceNotAuthorizedException(
                            "Access denied. This IP address is not registered for this kiosk.");
                }
                deviceMasterService.touchLastKnownIp(device.getDeviceId(), incomingIp);
                log.info("Login via registered device {} for employeeId: {}",
                        device.getDeviceId(), user.getEmployeeid());
                return device;
            }
            if (mode == DeviceAuthMode.DEVICE_ONLY) {
                throw new DeviceNotAuthorizedException(
                        "This kiosk is not registered. Contact your administrator to add this device.");
            }
        }

        authorizeLegacyUserDevice(user, incomingIp, incomingMac);
        return resolveDeviceIfPresent(incomingMac, incomingIp);
    }

    private void authorizeLegacyUserDevice(UserManagement user, String incomingIp, String incomingMac) {
        boolean viaTempGrant = tempDeviceGrantRepository
                .findActiveByEmployeeAndMac(user.getEmployeeid(), incomingMac)
                .isPresent();

        if (viaTempGrant) {
            log.info("Login via temporary device grant for employeeId: {} MAC: {}",
                    user.getEmployeeid(), incomingMac);
            return;
        }

        if (!incomingMac.isBlank()) {
            Optional<DeviceMasterDto> deviceOpt = deviceMasterService.resolveByMac(incomingMac);
            if (deviceOpt.isPresent()) {
                DeviceMasterDto device = deviceOpt.get();
                if (userRepository.hasRole(user.getEmployeeid(), 3)
                        && !isReceptionistAllowedOnDevice(user, device)) {
                    throw receptionistDeviceDenied(user, device);
                }
                if (userDeviceGrantRepository.hasActiveGrant(user.getEmployeeid(), device.getDeviceId())) {
                    log.info("Login via device grant for employeeId: {} device: {}",
                            user.getEmployeeid(), device.getDeviceId());
                    return;
                }
            }
        }

        if (userRepository.hasRole(user.getEmployeeid(), 3)) {
            throw new DeviceNotAuthorizedException(
                    "Sign in from your assigned kiosk or ask your supervisor for temporary desk access.");
        }

        log.info("Legacy login without registered kiosk for employeeId: {}", user.getEmployeeid());
    }

    private DeviceMasterDto resolveDeviceIfPresent(String mac, String ip) {
        return deviceMasterService.resolveByMac(mac)
                .map(device -> {
                    deviceMasterService.touchLastKnownIp(device.getDeviceId(), ip);
                    return device;
                })
                .orElse(null);
    }

    private static boolean locationsMatch(String deviceLocation, String userLocation) {
        if (deviceLocation == null || userLocation == null) {
            return false;
        }
        return deviceLocation.trim().equalsIgnoreCase(userLocation.trim());
    }

    private static String nullToEmpty(String value) {
        return value != null ? value : "";
    }

    private boolean isReceptionistAllowedOnDevice(UserManagement user, DeviceMasterDto device) {
        if (!userRepository.hasRole(user.getEmployeeid(), 3)) {
            return true;
        }
        if (userDeviceGrantRepository.hasActiveGrant(user.getEmployeeid(), device.getDeviceId())) {
            return true;
        }
        String assigned = user.getAssignedDeviceId();
        if (StringUtils.hasText(assigned)) {
            return assigned.trim().equalsIgnoreCase(device.getDeviceId().trim());
        }
        if (ENFORCE_ASSIGNED_DEVICE) {
            return false;
        }
        return true;
    }

    private DeviceNotAuthorizedException receptionistDeviceDenied(UserManagement user,
                                                                  DeviceMasterDto device) {
        if (!StringUtils.hasText(user.getAssignedDeviceId())) {
            return new DeviceNotAuthorizedException(
                    "No kiosk is assigned to your account. Contact your administrator.");
        }
        if (!user.getAssignedDeviceId().trim().equalsIgnoreCase(device.getDeviceId().trim())) {
            return new DeviceNotAuthorizedException(
                    "This kiosk is not assigned to your account. Contact your administrator.");
        }
        return new DeviceNotAuthorizedException(
                "You are not authorized to sign in from this kiosk.");
    }
}
