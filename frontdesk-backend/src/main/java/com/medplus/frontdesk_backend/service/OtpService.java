package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.dto.OtpSendResponseDto;
import com.medplus.frontdesk_backend.dto.OtpVerifyResponseDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;

/**
 * OtpService — handles generation, dispatch and verification of OTPs for
 * visitor mobile-number validation at check-in time.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  CURRENT STATE: IN-MEMORY MOCK                                           │
 * │                                                                          │
 * │  The OTP is generated here and stored in a ConcurrentHashMap.            │
 * │  No SMS is actually sent — the OTP is printed to the application log     │
 * │  so front-desk operators can test the flow right away.                   │
 * │                                                                          │
 * │  HOW TO WIRE THE REAL SMS GATEWAY (when ready):                          │
 * │  1. Inject your SMS gateway client (e.g. TwilioService / Msg91Client).   │
 * │  2. In sendOtp(), replace the log statement with the actual send call.   │
 * │  3. Remove the "MOCK" log lines.                                         │
 * │  Everything else — storage, expiry, verification — stays as-is.         │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
@Service
public class OtpService {

    private static final Logger log = LoggerFactory.getLogger(OtpService.class);

    private static final int OTP_EXPIRY_MINUTES = 10;

    /**
     * After OTP success, the user may complete {@code /book} within this window.
     * Separate from OTP expiry so a slow form fill does not force re-OTP immediately.
     */
    private static final int BOOKING_AUTH_WINDOW_MINUTES = 30;

    // In-memory store: mobile -> OtpEntry
    // Replace with Redis (with TTL) when scaling beyond a single node.
    private final ConcurrentHashMap<String, OtpEntry> otpStore = new ConcurrentHashMap<>();

    /** Visitor: 10-digit mobile → deadline for allowed {@code /book} (VISITOR). */
    private final ConcurrentHashMap<String, LocalDateTime> visitorBookingAuthUntil = new ConcurrentHashMap<>();

    /** Employee: empId → deadline for allowed {@code /book} (EMPLOYEE). */
    private final ConcurrentHashMap<String, LocalDateTime> employeeBookingAuthUntil = new ConcurrentHashMap<>();

    private final Random random = new Random();

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Generates a 6-digit OTP for the given mobile number and dispatches it
     * via the configured SMS gateway.
     *
     * TODO: SMS Gateway integration
     *   Inject your SMS client and replace the log.info line below with e.g.:
     *     smsClient.send("+91" + mobile, "Your Medplus visitor OTP is: " + otp
     *                    + ". Valid for " + OTP_EXPIRY_MINUTES + " minutes.");
     *
     * @param  mobile  10-digit mobile number (digits only, no country code)
     * @return {@link OtpSendResponseDto} indicating success/failure
     */
    public OtpSendResponseDto sendOtp(String mobile) {
        try {
            String otp = generateOtp();
            otpStore.put(mobile, new OtpEntry(otp, LocalDateTime.now().plusMinutes(OTP_EXPIRY_MINUTES)));

            // TODO: SMS Gateway — replace the line below with the real send call
            log.info("[OTP MOCK] Generated OTP {} for mobile {} (valid {} min)", otp, mobile, OTP_EXPIRY_MINUTES);

            return new OtpSendResponseDto(true, "OTP sent successfully.");
        } catch (Exception e) {
            log.error("[OTP] Failed to send OTP to {}: {}", mobile, e.getMessage());
            return new OtpSendResponseDto(false, "Failed to send OTP. Please try again.");
        }
    }

    /**
     * Verifies the supplied OTP against the stored one for the given mobile.
     * A successful verification removes the OTP from the store (one-time use).
     *
     * @param  mobile  10-digit mobile number
     * @param  otp     6-digit OTP string
     * @return {@link OtpVerifyResponseDto} indicating whether the OTP is valid
     */
    public OtpVerifyResponseDto verifyOtp(String mobile, String otp) {
        OtpEntry entry = otpStore.get(mobile);

        if (entry == null) {
            return new OtpVerifyResponseDto(false,
                    "OTP not found or already used. Please request a new OTP.");
        }

        if (entry.isExpired()) {
            otpStore.remove(mobile);
            return new OtpVerifyResponseDto(false,
                    "OTP has expired. Please request a new OTP.");
        }

        if (!entry.getOtp().equals(otp.trim())) {
            return new OtpVerifyResponseDto(false,
                    "Invalid OTP. Please try again.");
        }

        // Correct OTP — consume it (one-time use)
        otpStore.remove(mobile);
        log.info("[OTP] Mobile {} verified successfully.", mobile);
        return new OtpVerifyResponseDto(true, "Mobile number verified successfully.");
    }

    // ── Booking authorization (ties /book to a prior successful OTP) ─────────

    public void revokeVisitorBookingAuth(String mobile) {
        if (mobile != null && !mobile.isBlank()) {
            visitorBookingAuthUntil.remove(mobile.trim());
        }
    }

    public void grantVisitorBookingAuth(String mobile) {
        if (mobile == null || mobile.isBlank()) return;
        visitorBookingAuthUntil.put(
                mobile.trim(),
                LocalDateTime.now().plusMinutes(BOOKING_AUTH_WINDOW_MINUTES));
    }

    public void assertVisitorBookingAuth(String mobile) {
        if (mobile == null || mobile.isBlank()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Please verify your mobile number with OTP before booking.");
        }
        LocalDateTime until = visitorBookingAuthUntil.get(mobile.trim());
        if (until == null || LocalDateTime.now().isAfter(until)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Mobile verification expired or missing. Please request a new OTP and verify again.");
        }
    }

    public void consumeVisitorBookingAuth(String mobile) {
        if (mobile != null && !mobile.isBlank()) {
            visitorBookingAuthUntil.remove(mobile.trim());
        }
    }

    public void revokeEmployeeBookingAuth(String empId) {
        if (empId != null && !empId.isBlank()) {
            employeeBookingAuthUntil.remove(empId.trim());
        }
    }

    public void grantEmployeeBookingAuth(String empId) {
        if (empId == null || empId.isBlank()) return;
        employeeBookingAuthUntil.put(
                empId.trim(),
                LocalDateTime.now().plusMinutes(BOOKING_AUTH_WINDOW_MINUTES));
    }

    public void assertEmployeeBookingAuth(String empId) {
        if (empId == null || empId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Please verify your employee OTP before booking.");
        }
        LocalDateTime until = employeeBookingAuthUntil.get(empId.trim());
        if (until == null || LocalDateTime.now().isAfter(until)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Employee verification expired or missing. Please request a new OTP and verify again.");
        }
    }

    public void consumeEmployeeBookingAuth(String empId) {
        if (empId != null && !empId.isBlank()) {
            employeeBookingAuthUntil.remove(empId.trim());
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private String generateOtp() {
        return String.format("%06d", random.nextInt(1_000_000));
    }

    // ── Inner record ──────────────────────────────────────────────────────────

    private static class OtpEntry {
        private final String        otp;
        private final LocalDateTime expiresAt;

        OtpEntry(String otp, LocalDateTime expiresAt) {
            this.otp       = otp;
            this.expiresAt = expiresAt;
        }

        String getOtp() { return otp; }

        boolean isExpired() { return LocalDateTime.now().isAfter(expiresAt); }
    }
}
