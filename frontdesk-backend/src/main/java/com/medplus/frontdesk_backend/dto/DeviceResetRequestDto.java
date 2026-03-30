package com.medplus.frontdesk_backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DeviceResetRequestDto {

    @NotBlank(message = "New MAC address is required")
    private String newMacAddress;

    /** Optional audit note explaining the reason for the change. */
    private String reason;
}
