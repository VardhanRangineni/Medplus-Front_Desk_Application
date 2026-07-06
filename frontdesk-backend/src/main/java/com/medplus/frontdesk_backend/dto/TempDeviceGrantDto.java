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
public class TempDeviceGrantDto {

    private Long id;
    private String employeeId;
    private String employeeName;
    /** Registered kiosk (preferred). */
    private String deviceId;
    private String deviceName;
    /** Legacy MAC grant — deprecated; use deviceId. */
    private String macAddress;
    private LocalDateTime expiresAt;
    private String grantedBy;
    private String reason;
    private String status;
    private String revokedBy;
    private LocalDateTime revokedAt;
    private LocalDateTime createdAt;
}
