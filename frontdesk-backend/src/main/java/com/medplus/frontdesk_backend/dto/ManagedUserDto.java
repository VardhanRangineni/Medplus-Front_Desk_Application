package com.medplus.frontdesk_backend.dto;

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
}
