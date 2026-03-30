package com.medplus.frontdesk_backend.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserManagement {

    private String employeeid;
    private String ipaddress;
    private String password;
    private String location;
    private String status;
    private String role;
    private String macaddress;
}
