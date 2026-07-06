package com.medplus.frontdesk_backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class VisitorRequestDto {

    /** "VISITOR" or "EMPLOYEE" */
    @NotBlank(message = "entryType is required (VISITOR or EMPLOYEE)")
    private String entryType;

    @NotBlank(message = "Name is required")
    private String name;

    /** Mobile number — required for VISITOR */
    private String mobile;

    /** Employee ID — required for EMPLOYEE */
    private String empId;

    /** employeeid of the employee to be visited (from usermaster at this location) */
    @NotBlank(message = "Person to meet is required")
    private String personToMeetId;

    private Integer cardNumber;

    /** e.g. "AADHAAR", "PAN", "PASSPORT", "VOTER", "DL" — optional, VISITOR only */
    private String govtIdType;

    /** The actual ID number corresponding to govtIdType — optional */
    private String govtIdNumber;

    private String reasonForVisit;

    /** e.g. "INDIVIDUAL", "GROUP" — defaults to INDIVIDUAL if omitted */
    private String visitType;

    /**
     * Used only when personToMeetId is "__OTHER__".
     * Stores the name the front-desk operator typed manually.
     */
    private String personToMeetName;

    /**
     * Company or organisation name if the visitor is representing one.
     * Null or blank means "not representing a company".
     */
    private String companyName;

    /** Checking-in employee's HRMS department (EMPLOYEE entries only). */
    private String employeeDepartment;
}
