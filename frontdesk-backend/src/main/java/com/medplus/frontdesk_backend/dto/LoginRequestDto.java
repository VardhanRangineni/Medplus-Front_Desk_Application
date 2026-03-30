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

    @NotBlank(message = "IP address is required")
    private String ipAddress;

    @NotBlank(message = "MAC address is required")
    private String macAddress;
}
