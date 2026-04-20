package com.medplus.frontdesk_backend.model;

/**
 * Lifecycle states for a row in {@code appointmentslog}.
 *
 * <p>Rows are never physically deleted by decline/reschedule — they are kept
 * for reporting and updated in place. Check-in still removes the row today
 * (existing flow), but could be migrated to {@link #CHECKED_IN} if needed.
 */
public enum AppointmentStatus {
    /** Newly booked — visible to the front desk and blocks the slot. */
    PENDING,

    /** Employee declined the meeting invite — slot is freed for re-booking. */
    DECLINED,

    /** Booking still active but moved to a new date/time. */
    RESCHEDULED,

    /** Visitor already walked in — only used when the row is retained post-check-in. */
    CHECKED_IN,

    /** Booking cancelled by the visitor / front desk. */
    CANCELLED;

    /** Null-safe parser — defaults to PENDING. */
    public static AppointmentStatus fromString(String s) {
        if (s == null || s.isBlank()) return PENDING;
        try { return AppointmentStatus.valueOf(s.trim().toUpperCase()); }
        catch (IllegalArgumentException e) { return PENDING; }
    }
}
