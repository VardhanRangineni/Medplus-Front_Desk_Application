package com.medplus.frontdesk_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeviceResetResponseDto {

    private String employeeId;
    private String macAddress;
    private String performedBy;
    private String reason;
}
