package com.medplus.frontdesk_backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateDeviceRequestDto {
    @NotBlank
    private String locationId;

    @NotBlank
    @Size(max = 150)
    private String displayName;

    @Size(max = 20)
    private String floor;

    @Size(max = 100)
    private String area;

    @Size(max = 200)
    private String macAddress;

    @Size(max = 120)
    private String ipAddress;
}
