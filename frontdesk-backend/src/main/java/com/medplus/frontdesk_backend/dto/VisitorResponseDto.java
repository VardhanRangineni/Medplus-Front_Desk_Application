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
public class VisitorResponseDto {

    /** e.g. "MED-V-0001" */
    private String id;

    /** "VISITOR" or "EMPLOYEE" */
    private String type;

    private String name;
    private String mobile;
    private String empId;

    /** "checked-in" or "checked-out" */
    private String status;

    /** Full name of the person being visited */
    private String personToMeet;

    /** employeeid of person to meet (for edit forms) */
    private String personToMeetId;

    private String department;

    /** Alias for department — used by edit forms as "hostDepartment" */
    private String hostDepartment;

    private String locationId;

    /** Location human-readable name (resolved from locationmaster) */
    private String locationName;

    /** Printed visitor card number entered at check-in. */
    private Integer card;

    /** Government ID type used at check-in — e.g. "AADHAAR", "PAN" */
    private String govtIdType;

    /** Government ID number corresponding to govtIdType */
    private String govtIdNumber;

    /** e.g. "INDIVIDUAL", "GROUP" */
    private String visitType;

    /** Shared MED-GROUP-#### for group members; null for individual. */
    private String groupId;

    private LocalDateTime checkIn;
    private LocalDateTime checkOut;
    private String        reasonForVisit;

    /** Host approved the pending visit (Key Management). */
    private LocalDateTime approvedAt;

    /** Host rejected the pending visit (Key Management). */
    private LocalDateTime rejectedAt;

    /** Host rejection note when status is rejected. */
    private String        rejectionRemarks;

    /** Company or organisation the visitor is representing — null if not applicable. */
    private String        companyName;

    /** Receptionist / staff employee ID who performed check-in. */
    private String        createdBy;

    /** Workstation MAC recorded at check-in (same desk = shift handoff checkout). */
    private String        workstationMac;

    /** Desk walk-in visit pass QR token (preregistrations.token). */
    private String        visitPassToken;

    /** PENDING | SENT | FAILED | SKIPPED */
    private String        visitPassSmsStatus;

    /** User-facing note about visit pass SMS delivery. */
    private String        visitPassMessage;

    /** Kiosk/device where check-in was recorded. */
    private String        checkInDeviceId;
    private String        checkInDeviceName;

    /** Most recent zone scan or checkout device. */
    private String        lastScanDeviceId;
    private String        lastScanDeviceName;
    private LocalDateTime lastScanAt;
}
