package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.dto.LoginRequestDto;
import com.medplus.frontdesk_backend.dto.LoginResponseDto;
import com.medplus.frontdesk_backend.exception.AccountInactiveException;
import com.medplus.frontdesk_backend.exception.DeviceNotAuthorizedException;
import com.medplus.frontdesk_backend.exception.InvalidCredentialsException;
import com.medplus.frontdesk_backend.model.UserManagement;
import com.medplus.frontdesk_backend.model.UserMaster;
import com.medplus.frontdesk_backend.repository.UserRepository;
import com.medplus.frontdesk_backend.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    @Value("${jwt.expiration}")
    private long jwtExpirationMs;

    public LoginResponseDto login(LoginRequestDto request) {
        log.debug("Login attempt for employeeId: {} from IP: {}", request.getEmployeeId(), request.getIpAddress());

        // ── Step 1: Validate credentials ──────────────────────────────────────
        UserManagement user = userRepository.findByEmployeeId(request.getEmployeeId())
                .orElseThrow(() -> new InvalidCredentialsException("Invalid employee ID or password"));

        if ("INACTIVE".equalsIgnoreCase(user.getStatus())) {
            throw new AccountInactiveException(
                    "Your account is inactive. Please contact your administrator.");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            log.warn("Invalid password for employeeId: {}", request.getEmployeeId());
            throw new InvalidCredentialsException("Invalid employee ID or password");
        }

        // ── Step 2: MAC address locking ───────────────────────────────────────
        String storedMac = user.getMacaddress();
        String incomingMac = request.getMacAddress();

        if (!StringUtils.hasText(storedMac)) {
            // First-time login: register this device's MAC address
            log.info("First-time device registration for employeeId: {}, MAC: {}", user.getEmployeeid(), incomingMac);
        } else if (!storedMac.equalsIgnoreCase(incomingMac)) {
            // MAC mismatch: device not part of the registered Medplus network
            log.warn("MAC mismatch for employeeId: {}. Registered: {}, Provided: {}",
                    user.getEmployeeid(), storedMac, incomingMac);
            throw new DeviceNotAuthorizedException(
                    "Access denied. This device is not authorized for your account. " +
                    "Only registered Medplus network devices are allowed.");
        }

        // ── Step 3: Persist current IP + MAC (update on every valid login) ────
        userRepository.updateIpAndMac(user.getEmployeeid(), request.getIpAddress(), incomingMac);
        log.debug("Updated IP/MAC for employeeId: {}, IP: {}", user.getEmployeeid(), request.getIpAddress());

        // ── Step 4: Generate token and build response ─────────────────────────
        String token = jwtTokenProvider.generateToken(user.getEmployeeid(), user.getRole());

        UserMaster userMaster = userRepository.findUserMasterByEmployeeId(user.getEmployeeid())
                .orElse(null);

        String locationName = userRepository.findLocationName(user.getLocation())
                .orElse(user.getLocation());

        log.info("Successful login — employeeId: {}, role: {}, IP: {}, MAC: {}",
                user.getEmployeeid(), user.getRole(), request.getIpAddress(), incomingMac);

        return LoginResponseDto.builder()
                .token(token)
                .tokenType("Bearer")
                .employeeId(user.getEmployeeid())
                .role(user.getRole())
                .fullName(userMaster != null ? userMaster.getFullName() : user.getEmployeeid())
                .locationId(user.getLocation())
                .locationName(locationName)
                .expiresIn(jwtExpirationMs / 1000)
                .build();
    }
}
