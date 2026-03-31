package com.medplus.frontdesk_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VisitorResponseDto {

    /** e.g. "MED-V-0001" or "MED-GV-0001" */
    private String id;

    /** "VISITOR" or "EMPLOYEE" */
    private String type;

    /** "INDIVIDUAL" or "GROUP" */
    private String visitType;

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
    private String locationId;

    /** Visitor card / badge number */
    private Integer card;

    private LocalDateTime checkIn;
    private LocalDateTime checkOut;
    private String        reasonForVisit;

    private List<VisitorMemberDto> members;
}
