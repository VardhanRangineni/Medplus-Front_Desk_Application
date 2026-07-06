package com.medplus.frontdesk_backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateCityRequestDto {

    @NotBlank
    @Size(min = 3, max = 3)
    @Pattern(regexp = "^[A-Z]{3}$", message = "City code must be exactly 3 uppercase letters")
    private String cityCode;

    @NotBlank
    @Size(max = 100)
    private String cityName;

    @NotBlank
    @Size(min = 2, max = 2)
    @Pattern(regexp = "^[A-Z]{2}$", message = "State code must be exactly 2 uppercase letters")
    private String stateCode;
}
