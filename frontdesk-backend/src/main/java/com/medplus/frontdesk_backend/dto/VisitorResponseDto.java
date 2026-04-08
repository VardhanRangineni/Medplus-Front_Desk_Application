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

    /** Alias for department — used by edit forms as "hostDepartment" */
    private String hostDepartment;

    private String locationId;

    /** Location human-readable name (resolved from locationmaster) */
    private String locationName;

    /** Visitor card / badge number (manually entered — integer, legacy) */
    private Integer card;

    /** Lead card number — same as card for GROUP visits, null for INDIVIDUAL */
    private Integer leadCardNumber;

    /** Auto-assigned card code from cardmaster, e.g. "MSOH-VISITOR-7". Preferred over card if set. */
    private String cardCode;

    /** Government ID type used at check-in — e.g. "AADHAAR", "PAN" */
    private String govtIdType;

    /** Government ID number corresponding to govtIdType */
    private String govtIdNumber;

    private LocalDateTime checkIn;
    private LocalDateTime checkOut;
    private String        reasonForVisit;

    private List<VisitorMemberDto> members;
}
