package com.medplus.frontdesk_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Represents one row from the {@code roles} reference table.
 *
 * Used by:
 *   GET /api/managed-users/roles — returns the full list so the frontend
 *   can populate the role selector in the Add / Edit User modal.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoleDto {

    /** Stable numeric primary key (1=ADMIN, 2=SUPERVISOR, 3=RECEPTIONIST). */
    private int    id;

    /** Machine-readable code stored in the JWT and used in @PreAuthorize checks. */
    private String code;

    /** Human-readable label displayed in the UI (e.g. "Admin", "Supervisor"). */
    private String displayName;

    /** Short description of the role's access level. */
    private String description;
}
