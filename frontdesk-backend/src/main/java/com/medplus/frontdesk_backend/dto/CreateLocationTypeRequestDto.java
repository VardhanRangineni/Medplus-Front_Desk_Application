package com.medplus.frontdesk_backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateLocationTypeRequestDto {

    @NotBlank
    @Size(max = 100)
    private String typeName;
}
