package com.medplus.frontdesk_backend.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Response body returned after a successful appointment booking
 * and when polling GET /api/appointment/public/confirm/{token}.
 *
 * bookingToken is the UUID the public app stores in session to fetch this record.
 * bookingReference is the human-readable reference shown on the confirmation screen.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AppointmentConfirmationDto {

    /** UUID token used to retrieve this booking */
    private String bookingToken;

    /** Human-readable reference, e.g. "APT-20240722-0042" */
    private String bookingReference;

    /** "VISITOR" or "EMPLOYEE" */
    private String entryType;

    /** Visitor's full name (or employee's resolved name) */
    private String name;

    /** 10-digit mobile number */
    private String mobile;

    /** Employee ID (EMPLOYEE flow only) */
    private String empId;

    /** Optional email address */
    private String email;

    /** Full name of the person to meet */
    private String personToMeet;

    /** Employee ID of the person to meet */
    private String personToMeetId;

    /** Host department (auto-resolved from person-to-meet) */
    private String department;

    /** Office location ID (from locationmaster.LocationId) */
    private String locationId;

    /** Human-readable office location name (from locationmaster.descriptiveName) */
    private String locationName;

    /** Visitor-supplied reason for visit */
    private String reasonForVisit;

    /** Appointment date in ISO-8601: yyyy-MM-dd */
    private String appointmentDate;

    /** Appointment time slot, e.g. "10:00 AM" */
    private String appointmentTime;

    /**
     * Booking status.
     * PENDING   — submitted, awaiting front-desk confirmation
     * CONFIRMED — front-desk accepted the pre-registration
     * CANCELLED — cancelled by visitor or system
     */
    private String status;

    /** Server timestamp when the booking was created */
    private LocalDateTime createdAt;
}
