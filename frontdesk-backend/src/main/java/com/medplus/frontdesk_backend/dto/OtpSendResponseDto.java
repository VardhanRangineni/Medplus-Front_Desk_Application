package com.medplus.frontdesk_backend.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response body for POST /api/otp/send
 */
@Data
@NoArgsConstructor
public class OtpSendResponseDto {

    /** true if the OTP was generated and dispatched to the SMS gateway */
    private boolean success;

    /** Human-readable status message for the front-end to display */
    private String message;

    public OtpSendResponseDto(boolean success, String message) {
        this.success = success;
        this.message = message;
    }
}
