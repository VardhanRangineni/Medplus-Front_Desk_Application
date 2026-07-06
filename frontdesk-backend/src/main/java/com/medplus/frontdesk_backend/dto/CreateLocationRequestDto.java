package com.medplus.frontdesk_backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateLocationRequestDto {

    @NotNull
    private Long companyId;

    @NotNull
    private Long locationTypeId;

    /** State name or 2-letter state code (e.g. Telangana or TG). */
    @NotBlank
    @Size(max = 100)
    private String state;

    /** City name or 3-letter city code (e.g. Hyderabad or HYD). */
    @NotBlank
    @Size(max = 100)
    private String city;

    @NotBlank
    @Size(max = 500)
    private String address;
}
