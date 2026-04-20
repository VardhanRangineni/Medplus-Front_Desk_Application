package com.medplus.frontdesk_backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request body for {@code POST /api/busy-slots}.
 *
 * <p>Date/time are accepted as ISO-8601 strings (e.g. {@code "2026-04-25T14:30:00"})
 * so JavaScript clients can send them without custom serialisers.
 */
@Data
@NoArgsConstructor
public class BusySlotRequestDto {

    /**
     * {@code usermaster.employeeid} of the owner.
     * When omitted, the caller's JWT subject is used (see controller).
     */
    private String employeeId;

    /** ISO-8601 local date-time, e.g. "2026-04-25T14:30:00". */
    @NotBlank(message = "startTime is required")
    private String startTime;

    /** ISO-8601 local date-time strictly after {@code startTime}. */
    @NotBlank(message = "endTime is required")
    private String endTime;

    @Size(max = 255, message = "reason must be 255 characters or fewer")
    private String reason;

    /** When true, also push a "Busy" event to the employee's Zimbra calendar. */
    private boolean syncToZimbra;
}
