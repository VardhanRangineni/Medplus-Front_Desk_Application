package com.medplus.frontdesk_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PreRegPreviewDto {
    private String token;
    private String name;
    private String entryType;        // VISITOR or EMPLOYEE
    private String mobile;
    private String empId;
    private String govtIdType;
    private String govtIdNumber;

    // What the visitor typed as person to meet (free text, no ID)
    private String personName;
    private String hostDepartment;
    private String reasonForVisit;

    private String locationId;
    private String locationName;
    private String status;

    // Employee verification (populated when entryType = EMPLOYEE)
    private boolean empFound;
    private String  empFullName;
    private String  empDept;

    // Duplicate active check-in guard
    private boolean alreadyCheckedIn;
    private String  activeEntryId;
}
