package com.medplus.frontdesk_backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Request body for updating a visit reason name.
 */
@Data
public class UpdateVisitReasonRequestDto {

    @NotBlank(message = "reasonName is required")
    @Size(max = 255, message = "reasonName must not exceed 255 characters")
    private String reasonName;
}
