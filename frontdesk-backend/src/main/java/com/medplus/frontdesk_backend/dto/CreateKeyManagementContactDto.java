package com.medplus.frontdesk_backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateKeyManagementContactDto {

    @NotBlank(message = "mobile is required")
    @Pattern(regexp = "^[6-9]\\d{9}$", message = "mobile must be a valid 10-digit Indian mobile number")
    private String mobile;

    @Size(max = 150)
    private String displayName;
}
