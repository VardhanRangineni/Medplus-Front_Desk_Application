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
 *   location   ↔ locationmaster.descriptiveName  (resolved from/to FK on the backend)
 *   ipAddress  ↔ usermanagement.ipaddress
 *   macAddress ↔ usermanagement.macaddress
 *   status     ↔ usermanagement.status  (true = ACTIVE, false = INACTIVE)
 *   password   → write-only; never returned in GET responses (security).
 *               On create: if blank, defaults to BCrypt(employeeId).
 *               On update: if blank, the existing password is kept unchanged.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ManagedUserDto {

    private String  id;
    private String  name;
    private String  location;
    private String  ipAddress;
    private String  macAddress;
    private boolean status;

    /** Plain-text password supplied by the admin. Write-only — never serialised in responses. */
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String password;
}
