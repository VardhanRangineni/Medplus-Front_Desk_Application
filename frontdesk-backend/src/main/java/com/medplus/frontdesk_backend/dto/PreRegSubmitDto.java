package com.medplus.frontdesk_backend.dto;

import lombok.Data;

@Data
public class PreRegSubmitDto {
    private String entryType;       // "VISITOR" or "EMPLOYEE"
    private String name;
    private String mobile;
    private String empId;
    private String email;
    private String personToMeetId;
    private String personName;
    private String hostDepartment;
    private String reasonForVisit;
    private String govtIdType;     // e.g. "AADHAAR"
    private String govtIdNumber;   // 12-digit Aadhaar number
}
