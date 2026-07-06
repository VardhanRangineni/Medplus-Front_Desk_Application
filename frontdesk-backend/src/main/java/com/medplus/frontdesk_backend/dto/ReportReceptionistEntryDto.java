package com.medplus.frontdesk_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One visitor-log row for staff activity report.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReportReceptionistEntryDto {

    private String visitorId;

    /** Employee ID of the receptionist who recorded this entry. */
    private String createdBy;

    /** Full name of the receptionist (from usermanagement). */
    private String receptionistName;

    private String visitorName;
    private String mobile;
    private String empId;

    /** VISITOR or EMPLOYEE */
    private String entryType;

    private String department;

    /** Host person display name. */
    private String personToMeet;

    private String locationId;
    private Integer cardNumber;
    private String companyName;

    /** Front-desk PC MAC at check-in. */
    private String workstationMac;

    private String checkInTime;
    private String checkOutTime;

    /** CHECKED_IN or CHECKED_OUT */
    private String status;

    /** Staff who performed check-out (if any). */
    private String modifiedBy;
}
