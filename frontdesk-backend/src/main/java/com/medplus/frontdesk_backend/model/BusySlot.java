package com.medplus.frontdesk_backend.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * A manual busy-time block owned by an employee.
 *
 * <p>Booking / reschedule requests that overlap any active BusySlot for the
 * same employee are rejected. When Zimbra sync is enabled the record also
 * carries the remote {@code zimbraEventId} so we can clean it up on remove.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BusySlot {

    /** UUID primary key. */
    private String id;

    /** {@code usermaster.employeeid} of the owner. */
    private String employeeId;

    private LocalDateTime startTime;
    private LocalDateTime endTime;

    /** Human-readable reason (e.g. "Lunch", "Personal appointment"). Optional. */
    private String reason;

    /** Zimbra invId when the block was mirrored to the calendar — may be null. */
    private String zimbraEventId;

    /** Who created the block (JWT subject). */
    private String createdBy;

    private LocalDateTime createdAt;
}
