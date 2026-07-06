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
public class VisitorMovementEventDto {

    private long id;

    /** CHECK_IN | ZONE_SCAN | CHECK_OUT */
    private String eventType;

    private String deviceId;
    private String deviceName;
    private String locationId;
    private String locationName;
    private String floor;
    private String area;

    private LocalDateTime scannedAt;
    private String scannedBy;
}
