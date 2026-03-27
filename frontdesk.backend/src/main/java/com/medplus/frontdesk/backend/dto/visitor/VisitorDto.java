package com.medplus.frontdesk.backend.dto.visitor;

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Read-only view of a visitor row returned after check-in. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class VisitorDto {

    private String visitorId;
    private String visitorType;
    private String fullName;
    private String locationId;
    private String identificationNumber;
    private String govtId;
    private String groupHeadVisitorId;
    private String status;
    private String personToMeet;
    private String cardNumber;
    private LocalDateTime checkInTime;
    private LocalDateTime checkOutTime;
    private String createdBy;
    private LocalDateTime createdAt;
}
