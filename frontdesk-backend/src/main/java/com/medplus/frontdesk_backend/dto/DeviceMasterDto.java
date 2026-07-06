package com.medplus.frontdesk_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeviceMasterDto {
    private String deviceId;
    private String locationId;
    private String locationName;
    private String displayName;
    private String floor;
    private String area;
    private String macAddress;
    private String ipAddress;
    private String lastKnownIp;
    private boolean active;
    private LocalDateTime createdAt;
    private LocalDateTime modifiedAt;
}
