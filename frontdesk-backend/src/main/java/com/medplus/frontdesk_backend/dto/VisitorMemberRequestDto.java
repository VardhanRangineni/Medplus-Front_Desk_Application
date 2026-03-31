package com.medplus.frontdesk_backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class VisitorMemberRequestDto {

    @NotBlank(message = "Member name is required")
    private String  name;
    private Integer cardNumber;
}
