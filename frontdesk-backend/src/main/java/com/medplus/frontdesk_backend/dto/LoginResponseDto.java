package com.medplus.frontdesk_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoginResponseDto {

    private String token;
    private String tokenType;
    private String employeeId;
    private String role;
    private String fullName;
    private String locationId;
    private String locationName;
    private long expiresIn;
}
