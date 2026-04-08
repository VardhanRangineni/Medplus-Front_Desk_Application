package com.medplus.frontdesk_backend.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Request body for submitting a new card request. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CardRequestSubmitDto {

    @NotBlank(message = "locationId is required")
    private String locationId;

    /** ADDITIONAL | REPLACEMENT */
    @NotBlank(message = "requestType is required (ADDITIONAL or REPLACEMENT)")
    private String requestType;

    @NotNull(message = "quantity is required")
    @Min(value = 1, message = "quantity must be at least 1")
    private Integer quantity;

    private String notes;
}
