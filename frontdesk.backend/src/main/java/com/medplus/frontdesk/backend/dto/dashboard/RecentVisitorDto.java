package com.medplus.frontdesk.backend.dto.dashboard;

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RecentVisitorDto {
    private String visitorId;
    private String visitorType;
    private String fullName;
    private String identificationNumber;
    private String govtId;
    private String locationId;
    private String locationName;
    private String status;
    private String personToMeet;
    private String cardNumber;
    private LocalDateTime checkInTime;
    private LocalDateTime checkOutTime;
}

