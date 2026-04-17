package com.medplus.frontdesk_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Represents a single bookable time slot returned by
 * GET /api/appointment/public/slots?date=&personId=
 *
 * available = false means the slot is already taken for that person on that date.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AppointmentSlotDto {

    /** Display label, e.g. "10:00 AM" */
    private String time;

    /** 24-hour value used for sorting / comparison, e.g. "10:00" */
    private String value;

    /** true if the slot is open and can be booked */
    private boolean available;
}
