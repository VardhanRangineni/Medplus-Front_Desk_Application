package com.medplus.frontdesk_backend.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserMaster {

    private String employeeid;
    private String fullName;
    private String workemail;
    private String phone;
    private String designation;
    private String role;
    private String worklocation;
    private String department;
}
