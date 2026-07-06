package com.medplus.frontdesk_backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Represents a usermanagement record as seen by the frontend.
 *
 * Used for:
 *   GET  /api/managed-users          (response list item)
 *   POST /api/managed-users          (request body + response)
 *   PUT  /api/managed-users/{id}     (request body + response)
 *   PATCH /api/managed-users/{id}/status (response)
 *
 * Field mapping:
 *   id         ↔ usermanagement.employeeid
 *   name       ↔ usermanagement.fullName
 *   location   ↔ locationmaster.descriptiveName  (supervisors only)
 *   status     ↔ usermanagement.status  (true = ACTIVE, false = INACTIVE)
 *   roleId     ↔ usermanagement.roleId  (FK → roles.id)
 *   roleName   ← roles.displayName      (read-only, resolved by JOIN on GET)
 *   password   → write-only; never returned in GET responses (security).
 *               On create: if blank, defaults to BCrypt(employeeId).
 *               On update: if blank, the existing password is kept unchanged.
 */
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ManagedUserDto {

    private String  id;
    private String  name;
    /** Primary / display location (first assigned). Supervisors may have more in {@link #locationIds}. */
    private String  location;
    /**
     * All assigned location IDs (supervisors). On create/update send full set.
     * If omitted, {@link #location} is used as the sole location.
     */
    private List<String> locationIds;
    private boolean status;

    /**
     * Primary role ID (highest privilege). Derived from {@link #roleIds} on save.
     */
    private Integer roleId;

    /**
     * All assigned role IDs (multi-role). On create/update send the full set.
     * If omitted, {@link #roleId} is used as the sole role.
     */
    private List<Integer> roleIds;

    /**
     * Human-readable role label resolved by JOIN with the {@code roles} table.
     * Populated in GET responses only — ignored on POST/PUT (use {@code roleId} instead).
     */
    private String roleName;

    /** Employee ID of the admin who provisioned this account (empty for legacy seeds). */
    private String createdBy;

    /** Plain-text password supplied by the admin. Write-only — never serialised in responses. */
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String password;

    /** Active temporary desk access grant, if any (read-only). */
    private TempDeviceGrantDto activeTempGrant;

    /** Registered kiosk this user may sign in from (receptionists). */
    private String assignedDeviceId;

    /** Display name of {@link #assignedDeviceId} (read-only). */
    private String assignedDeviceName;

    /** HRMS designation — used on create when provisioning from HRMS lookup. */
    private String designation;

    /** HRMS department — used on create when provisioning from HRMS lookup. */
    private String department;

    /** Contact phone from HRMS — used on create. */
    private String phone;

    /** Work email from HRMS — used on create. */
    private String workEmail;
}
