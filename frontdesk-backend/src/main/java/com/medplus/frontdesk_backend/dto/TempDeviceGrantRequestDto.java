package com.medplus.frontdesk_backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TempDeviceGrantRequestDto {

    /** Registered kiosk from Device Master (preferred). */
    private String deviceId;

    /** Desk workstation MAC. Legacy — use deviceId. */
    private String macAddress;

    /**
     * Absent receptionist whose registered desk (MAC/IP) the cover user will use.
     * Preferred over manual macAddress.
     */
    private String absentEmployeeId;

    /** @deprecated Use absentEmployeeId. Kept for backward compatibility. */
    private String copyMacFromEmployeeId;

    /** Explicit expiry. Takes precedence over durationHours. */
    private LocalDateTime expiresAt;

    /** Hours from now when expiresAt is not set (default 8). */
    private Integer durationHours;

    @NotBlank(message = "Reason is required.")
    private String reason;
}
