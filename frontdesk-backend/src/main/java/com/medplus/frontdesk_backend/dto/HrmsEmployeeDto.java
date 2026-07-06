package com.medplus.frontdesk_backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class HrmsEmployeeDto {

    @JsonProperty("fullName")
    private String fullName;

    @JsonProperty("hrmsId")
    private String hrmsId;

    @JsonProperty("employeeId")
    private String employeeId;

    @JsonProperty("workEmail")
    private String workEmail;

    @JsonProperty("workPhoneNo")
    private String workPhoneNo;

    @JsonProperty("personalPhoneNo")
    private String personalPhoneNo;

    /** Prefer work phone; falls back to personal. */
    public String getPhone() {
        if (workPhoneNo != null && !workPhoneNo.isBlank()) {
            return workPhoneNo.trim();
        }
        return personalPhoneNo != null ? personalPhoneNo.trim() : null;
    }

    @JsonProperty("companyName")
    private String companyName;

    @JsonProperty("designation")
    private String designation;

    @JsonProperty("workLocation")
    private String workLocation;

    @JsonProperty("department")
    private String department;

    @JsonProperty("role")
    private String role;
}
