package com.medplus.frontdesk_backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request body for POST /api/otp/verify
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class OtpVerifyRequestDto {

    @NotBlank(message = "mobile is required")
    @Pattern(regexp = "^[6-9]\\d{9}$", message = "mobile must be a valid 10-digit Indian mobile number")
    private String mobile;

    @NotBlank(message = "otp is required")
    @Pattern(regexp = "^\\d{6}$", message = "otp must be exactly 6 digits")
    private String otp;
}
