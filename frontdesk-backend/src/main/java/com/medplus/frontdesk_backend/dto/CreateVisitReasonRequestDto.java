package com.medplus.frontdesk_backend.dto;

import com.medplus.frontdesk_backend.model.VisitReasonType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Request body for creating a new visit reason.
 */
@Data
public class CreateVisitReasonRequestDto {

    @NotNull(message = "type is required (VISITOR or EMPLOYEE)")
    private VisitReasonType type;

    @NotBlank(message = "reasonName is required")
    @Size(max = 255, message = "reasonName must not exceed 255 characters")
    private String reasonName;
}
