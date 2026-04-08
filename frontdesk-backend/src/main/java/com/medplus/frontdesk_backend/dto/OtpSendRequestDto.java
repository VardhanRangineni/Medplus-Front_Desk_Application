package com.medplus.frontdesk_backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request body for POST /api/otp/send
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class OtpSendRequestDto {

    @NotBlank(message = "mobile is required")
    @Pattern(regexp = "^[6-9]\\d{9}$", message = "mobile must be a valid 10-digit Indian mobile number")
    private String mobile;
}
