package com.medplus.frontdesk_backend.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request body for {@code POST /api/appointments/{id}/decline}.
 * The only field is an optional free-text reason persisted on the row.
 */
@Data
@NoArgsConstructor
public class DeclineAppointmentRequestDto {

    @Size(max = 500, message = "reason must be 500 characters or fewer")
    private String reason;
}
