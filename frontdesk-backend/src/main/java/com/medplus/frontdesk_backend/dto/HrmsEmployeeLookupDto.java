package com.medplus.frontdesk_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Normalized HRMS employee record returned to the Electron app.
 * Maps the external {@code data[0]} payload from HRMS employee-details API.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HrmsEmployeeLookupDto {

    /** Official employee ID (OTG…). */
    private String id;

    private String hrmsId;

    /** Full name from HRMS ({@code fullName}). */
    private String name;

    private String workEmail;
    private String workPhoneNo;
    private String personalPhoneNo;

    /** Preferred contact number (work, then personal). */
    private String phone;

    private String companyName;
    private String designation;
    private String workLocation;
    private String department;
    private String role;
}
