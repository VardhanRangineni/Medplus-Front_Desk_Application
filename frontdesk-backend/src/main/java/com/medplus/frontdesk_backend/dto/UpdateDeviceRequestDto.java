package com.medplus.frontdesk_backend.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateDeviceRequestDto {
    /** When set, moves the device to another location (same deviceId retained). */
    @Size(max = 50)
    private String locationId;

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
