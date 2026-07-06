package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.client.MedplusOtpClient;
import com.medplus.frontdesk_backend.dto.OtpSendResponseDto;
import com.medplus.frontdesk_backend.dto.OtpVerifyResponseDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * OtpService — thin facade over {@link MedplusOtpClient}.
 *
 * <p>The MedPlus message-service owns OTP generation and verification.
 * This service layer keeps controllers decoupled from the HTTP client.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OtpService {

    private final MedplusOtpClient medplusOtpClient;

    public OtpSendResponseDto sendOtp(String mobile) {
        log.debug("[OTP] sendOtp for mobile ...{}", last4(mobile));
        return medplusOtpClient.sendOtp(mobile);
    }

    public OtpVerifyResponseDto verifyOtp(String mobile, String otp) {
        log.debug("[OTP] verifyOtp for mobile ...{}", last4(mobile));
        return medplusOtpClient.verifyOtp(mobile, otp);
    }

    private static String last4(String mobile) {
        if (mobile == null || mobile.length() < 4) return "****";
        return mobile.substring(mobile.length() - 4);
    }
}
