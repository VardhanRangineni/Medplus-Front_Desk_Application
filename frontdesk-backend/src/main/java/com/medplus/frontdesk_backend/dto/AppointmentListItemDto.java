package com.medplus.frontdesk_backend.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Lightweight DTO returned by GET /api/appointments for the front-desk
 * Appointments page.  Field names are intentionally aligned with what the
 * React frontend's appointmentsService.js expects (e.g. "patientName", "id").
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AppointmentListItemDto {

    /** Human-readable booking reference, e.g. "APT-20260416-0001" */
    private String id;

    /** Full name of the visitor / employee who booked the appointment */
    private String patientName;

    /** Mobile number */
    private String mobile;

    /** Employee ID (EMPLOYEE bookings only) */
    private String empId;

    /** Email address */
    private String email;

    /** Full name of the person to meet (doctor / staff) */
    private String personToMeet;

    /** Host department */
    private String department;

    /**
     * Combined appointment date + time as an ISO-8601 datetime string,
     * e.g. "2026-04-16T16:00:00".  The frontend calls new Date() on this value.
     */
    private String appointmentDate;

    /**
     * Booking status.
     * PENDING    — awaiting front-desk confirmation
     * CHECKED_IN — patient has arrived and been checked in
     * COMPLETED  — visit finished
     * CANCELLED  — cancelled
     */
    private String status;

    /** Free-text reason / purpose for the visit */
    private String reason;

    /** Office location ID */
    private String locationId;

    /** Human-readable office location name */
    private String locationName;

    /** "VISITOR" or "EMPLOYEE" */
    private String entryType;
}
