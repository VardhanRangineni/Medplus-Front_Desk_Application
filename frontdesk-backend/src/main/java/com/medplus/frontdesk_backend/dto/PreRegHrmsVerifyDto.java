package com.medplus.frontdesk_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Public pre-registration form — HRMS employee lookup result. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PreRegHrmsVerifyDto {
    private boolean found;
    private String employeeId;
    private String hrmsId;
    private String name;
    private String department;
    private String message;
}
