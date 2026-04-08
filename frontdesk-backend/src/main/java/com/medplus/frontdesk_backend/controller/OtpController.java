package com.medplus.frontdesk_backend.controller;

import com.medplus.frontdesk_backend.dto.ApiResponse;
import com.medplus.frontdesk_backend.dto.OtpSendRequestDto;
import com.medplus.frontdesk_backend.dto.OtpSendResponseDto;
import com.medplus.frontdesk_backend.dto.OtpVerifyRequestDto;
import com.medplus.frontdesk_backend.dto.OtpVerifyResponseDto;
import com.medplus.frontdesk_backend.service.OtpService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * OtpController — REST endpoints for visitor mobile-number OTP verification.
 *
 * Both endpoints require a valid JWT (the front-desk operator must be logged in).
 * They are called from AddVisitorModal in Step 0 of the visitor check-in flow.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  Flow overview                                                           │
 * │                                                                          │
 * │  1. Operator enters visitor's mobile → clicks "Send OTP"                 │
 * │       → POST /api/otp/send  { mobile }                                  │
 * │       → OtpService generates OTP, dispatches via SMS gateway (mocked)   │
 * │                                                                          │
 * │  2. Visitor reads OTP from phone → operator enters it → "Verify OTP"    │
 * │       → POST /api/otp/verify  { mobile, otp }                           │
 * │       → OtpService validates → returns verified: true/false             │
 * │                                                                          │
 * │  3. On verified: true → front-end advances to Step 1 (Visitor Details)  │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
@Slf4j
@RestController
@RequestMapping("/api/otp")
@RequiredArgsConstructor
public class OtpController {

    private final OtpService otpService;

    // ── POST /api/otp/send ────────────────────────────────────────────────────

    /**
     * Generates and dispatches an OTP to the visitor's mobile number.
     *
     * Request:
     * <pre>
     * POST /api/otp/send
     * Authorization: Bearer <jwt>
     * Content-Type: application/json
     *
     * { "mobile": "9876543210" }
     * </pre>
     *
     * Success response (200):
     * <pre>{ "data": { "success": true, "message": "OTP sent successfully." } }</pre>
     *
     * Failure response (400 — validation error or gateway failure):
     * <pre>{ "data": { "success": false, "message": "<reason>" } }</pre>
     */
    @PostMapping("/send")
    public ResponseEntity<ApiResponse<OtpSendResponseDto>> sendOtp(
            @Valid @RequestBody OtpSendRequestDto request) {

        log.debug("[OTP] sendOtp requested for mobile ending in ...{}", last4(request.getMobile()));
        OtpSendResponseDto response = otpService.sendOtp(request.getMobile());
        return ResponseEntity.ok(ApiResponse.success("OTP dispatch completed.", response));
    }

    // ── POST /api/otp/verify ──────────────────────────────────────────────────

    /**
     * Verifies the OTP entered by the front-desk operator for a given mobile.
     *
     * Request:
     * <pre>
     * POST /api/otp/verify
     * Authorization: Bearer <jwt>
     * Content-Type: application/json
     *
     * { "mobile": "9876543210", "otp": "483921" }
     * </pre>
     *
     * Success response (200):
     * <pre>{ "data": { "verified": true,  "message": "Mobile number verified successfully." } }</pre>
     *
     * Invalid/expired OTP (200 — not an error, just a business outcome):
     * <pre>{ "data": { "verified": false, "message": "Invalid OTP. Please try again." } }</pre>
     */
    @PostMapping("/verify")
    public ResponseEntity<ApiResponse<OtpVerifyResponseDto>> verifyOtp(
            @Valid @RequestBody OtpVerifyRequestDto request) {

        log.debug("[OTP] verifyOtp requested for mobile ending in ...{}", last4(request.getMobile()));
        OtpVerifyResponseDto response = otpService.verifyOtp(request.getMobile(), request.getOtp());
        return ResponseEntity.ok(ApiResponse.success("OTP verification completed.", response));
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private static String last4(String mobile) {
        if (mobile == null || mobile.length() < 4) return "****";
        return mobile.substring(mobile.length() - 4);
    }
}
