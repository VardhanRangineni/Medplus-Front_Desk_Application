package com.medplus.frontdesk_backend.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Visitor {

    private String        visitorId;
    private VisitType     visitType;
    /** Shared MED-GROUP-#### for group visits; null for individual. */
    private String        groupId;
    private EntryType     entryType;
    private String        name;
    private String        mobile;
    private String        empId;
    private VisitStatus   status;
    private String        personToMeet;
    private String        personName;
    /** Host mobile snapshot at check-in — used for Key Management portal matching. */
    private String        personToMeetPhone;
    private String        department;
    private String        locationId;
    private Integer       cardNumber;
    private GovtIdType    govtIdType;
    private String        govtIdNumber;
    private LocalDateTime checkInTime;
    private LocalDateTime checkOutTime;
    private LocalDateTime approvedAt;
    private LocalDateTime rejectedAt;
    private String        rejectionRemarks;
    private String        reasonForVisit;
    /** Company or organisation the visitor is representing — null if none. */
    private String        companyName;
    private String        createdBy;
    /** Last editor / actor who mutated the row (audit). Never replaces {@link #createdBy}. */
    private String        modifiedBy;
    /** MAC of front-desk PC at check-in — enables shift handoff on same workstation. */
    private String        workstationMac;
    private String        checkInDeviceId;
    private String        lastScanDeviceId;
    private LocalDateTime lastScanAt;
}
