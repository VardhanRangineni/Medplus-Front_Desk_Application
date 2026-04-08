package com.medplus.frontdesk_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response body for POST /api/otp/verify
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class OtpVerifyResponseDto {

    /** true if the supplied OTP matches the stored OTP and has not expired */
    private boolean verified;

    /** Human-readable status message for the front-end to display */
    private String message;
}
