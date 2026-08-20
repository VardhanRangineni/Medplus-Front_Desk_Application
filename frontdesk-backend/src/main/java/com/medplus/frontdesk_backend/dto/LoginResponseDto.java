package com.medplus.frontdesk_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoginResponseDto {

    private String token;
    private String tokenType;
    private String employeeId;
    /** Primary role (highest privilege) for backward-compatible UI checks. */
    private String role;
    /** All assigned roles — e.g. ["PRIMARY_ADMIN", "RECEPTIONIST"]. */
    private List<String> roles;
    private String fullName;
    /** Primary location (first assigned / session default). */
    private String locationId;
    private String locationName;
    /** All locations this user may access (supervisors with multi-site). */
    private List<String> locationIds;
    private String deviceId;
    private String deviceName;
    /** Department of the user — meaningful for DEPT_HEAD role to scope queries. */
    private String department;
    private long expiresIn;
}
