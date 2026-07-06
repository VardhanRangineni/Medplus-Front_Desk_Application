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
public class VisitorScanResponseDto {

    private String visitorId;
    private String visitorName;
    private String status;
    private String eventType;
    private String deviceId;
    private String deviceName;
    private String locationId;
    private String locationName;
    private LocalDateTime scannedAt;
    private boolean duplicateSuppressed;
    private String message;
}
