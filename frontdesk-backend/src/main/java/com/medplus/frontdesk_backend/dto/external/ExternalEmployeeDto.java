package com.medplus.frontdesk_backend.dto.external;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Maps one employee record from the external HR/ERP API.
 *
 * Expected JSON shape:
 * {
 *   "employeeId":   "EMP001",
 *   "fullName":     "John Doe",
 *   "workEmail":    "john.doe@medplus.com",
 *   "phone":        "9000000001",
 *   "designation":  "Receptionist",
 *   "workLocation": "Medplus Head Office Hyderabad",
 *   "department":   "Front Desk",
 *   "role":         "RECEPTIONIST"
 * }
 */
@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ExternalEmployeeDto {

    @JsonProperty("employeeId")
    private String employeeId;

    @JsonProperty("fullName")
    private String fullName;

    @JsonProperty("workEmail")
    private String workEmail;

    @JsonProperty("phone")
    private String phone;

    @JsonProperty("designation")
    private String designation;

    @JsonProperty("workLocation")
    private String workLocation;

    @JsonProperty("department")
    private String department;

    @JsonProperty("role")
    private String role;
}
