package com.medplus.frontdesk_backend.dto;

import com.medplus.frontdesk_backend.model.BusySlot;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * API response shape for busy-slot endpoints.
 */
@Data
@Builder
public class BusySlotResponseDto {
    private String        id;
    private String        employeeId;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private String        reason;
    private String        zimbraEventId;
    private String        createdBy;
    private LocalDateTime createdAt;

    public static BusySlotResponseDto from(BusySlot s) {
        return BusySlotResponseDto.builder()
                .id            (s.getId())
                .employeeId    (s.getEmployeeId())
                .startTime     (s.getStartTime())
                .endTime       (s.getEndTime())
                .reason        (s.getReason())
                .zimbraEventId (s.getZimbraEventId())
                .createdBy     (s.getCreatedBy())
                .createdAt     (s.getCreatedAt())
                .build();
    }
}
