package com.medplus.frontdesk_backend.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * OtpToken — model class representing pending OTP token mapped to mobile numbers.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OtpToken {
    private String mobileNumber;
    /** Stores the OAuth access token used when requesting the OTP (session-bound). */
    private String token;
    private LocalDateTime createdAt;
    private LocalDateTime expiresAt;
}
