package com.medplus.frontdesk_backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request body for {@code POST /api/appointments/{id}/reschedule}.
 *
 * <p>Dates / times follow the same conventions as the public booking API:
 * date is {@code yyyy-MM-dd} and time is the display format used on the
 * booking UI (e.g. {@code "10:30 AM"}). This keeps the same parser in
 * {@code AppointmentService} useable for both flows.
 */
@Data
@NoArgsConstructor
public class RescheduleAppointmentRequestDto {

    @NotBlank(message = "newDate is required (yyyy-MM-dd)")
    private String newDate;

    @NotBlank(message = "newTime is required (e.g. '10:30 AM')")
    private String newTime;
}
