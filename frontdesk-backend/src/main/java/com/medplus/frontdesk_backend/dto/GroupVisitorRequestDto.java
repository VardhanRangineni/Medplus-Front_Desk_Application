package com.medplus.frontdesk_backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class GroupVisitorRequestDto {

    /** "VISITOR" or "EMPLOYEE" */
    @NotBlank(message = "entryType is required (VISITOR or EMPLOYEE)")
    private String entryType;

    @NotBlank(message = "Person to meet is required")
    private String personToMeetId;

    private Integer cardNumber;

    private String govtIdType;
    private String govtIdNumber;
    private String reasonForVisit;
    private String companyName;

    @NotEmpty(message = "At least one group member is required")
    @Size(max = 50, message = "Group cannot exceed 50 members")
    @Valid
    private List<GroupVisitorMemberDto> members;
}
