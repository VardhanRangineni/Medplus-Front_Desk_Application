package com.medplus.frontdesk_backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class VisitorRequestDto {

    /** "INDIVIDUAL" or "GROUP" */
    @NotBlank(message = "visitType is required (INDIVIDUAL or GROUP)")
    private String visitType;

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

    /** Members list — required (and non-empty) when visitType = GROUP */
    @Valid
    private List<VisitorMemberRequestDto> members;
}
