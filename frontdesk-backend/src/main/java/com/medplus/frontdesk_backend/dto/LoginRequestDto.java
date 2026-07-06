package com.medplus.frontdesk_backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LoginRequestDto {

    @NotBlank(message = "Employee ID is required")
    private String employeeId;

    @NotBlank(message = "Password is required")
    private String password;

    /** Optional for PRIMARY_ADMIN (device lock skipped). Required for other roles at validation time. */
    private String ipAddress;

    /** Optional for PRIMARY_ADMIN (device lock skipped). Required for other roles at validation time. */
    private String macAddress;
}
