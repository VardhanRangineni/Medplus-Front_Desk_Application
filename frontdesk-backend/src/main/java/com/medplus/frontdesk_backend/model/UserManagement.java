package com.medplus.frontdesk_backend.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserManagement {

    private String     employeeid;
    private String     fullName;
    private String     password;
    private String     location;
    private UserStatus status;
    /** Primary role (highest privilege) — mirrors {@code usermanagement.roleId}. */
    private UserRole   role;
    /** All assigned roles from {@code user_role_mapping}. */
    private List<UserRole> roles;
    private String     assignedDeviceId;
    private boolean    loginEnabled;
    /** Employee ID of admin who created this user; {@code SYSTEM} for seeds. */
    private String     createdBy;
}
