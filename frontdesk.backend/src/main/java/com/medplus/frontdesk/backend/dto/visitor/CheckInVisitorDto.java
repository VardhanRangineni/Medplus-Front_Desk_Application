package com.medplus.frontdesk.backend.dto.visitor;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

/** Request body for a single visitor check-in (also reused per member in a group check-in). */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CheckInVisitorDto {

    @NotBlank(message = "visitorType is required")
    @Pattern(regexp = "NONEMPLOYEE|EMPLOYEE",
             message = "visitorType must be NONEMPLOYEE or EMPLOYEE")
    private String visitorType;

    @NotBlank(message = "fullName is required")
    @Size(max = 150)
    private String fullName;

    @NotBlank(message = "locationId is required")
    @Size(max = 50)
    private String locationId;

    @NotBlank(message = "identificationNumber is required")
    @Size(max = 100)
    private String identificationNumber;

    @Size(max = 120)
    private String govtId;

    @Size(max = 150)
    private String personToMeet;

    @Size(max = 50)
    private String cardNumber;
}
