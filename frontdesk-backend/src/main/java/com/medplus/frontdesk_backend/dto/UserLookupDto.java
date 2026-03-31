package com.medplus.frontdesk_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Lightweight projection returned by the user-lookup search endpoint.
 * Used by the Add / Edit User modal to auto-fill form fields when
 * the operator types an Employee ID or Employee Name.
 *
 * Endpoint: GET /api/managed-users/search?q={query}
 *
 * Field mapping (all from usermaster):
 *   id           ← employeeid
 *   name         ← fullName
 *   location     ← worklocation  (HR default; operator can override in the form)
 *   designation  ← designation
 *   department   ← department
 *   email        ← workemail
 *   phone        ← phone
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserLookupDto {

    private String id;
    private String name;
    private String location;
    private String designation;
    private String department;
    private String email;
    private String phone;
}
