package com.medplus.frontdesk_backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request body for POST /api/appointment/public/book
 *
 * Carries the complete appointment submission from the public booking web app.
 * entryType drives which fields are mandatory:
 *   VISITOR  → name, mobile, aadhaarNumber are required
 *   EMPLOYEE → empId is required (name resolved server-side from usermaster)
 */
@Data
@NoArgsConstructor
public class AppointmentBookingRequestDto {

    /** "VISITOR" or "EMPLOYEE" */
    @NotBlank(message = "entryType is required")
    private String entryType;

    /** Visitor's full name (required for VISITOR entries) */
    private String name;

    /** 10-digit mobile number (required for VISITOR entries; used for OTP verification) */
    @Pattern(regexp = "^[6-9]\\d{9}$|^$", message = "mobile must be a valid 10-digit Indian mobile number")
    private String mobile;

    /** Employee ID (required for EMPLOYEE entries) */
    private String empId;

    /** Optional email address */
    @Pattern(regexp = "^[\\w.+\\-]+@[\\w\\-]+\\.[a-zA-Z]{2,}$|^$",
             message = "email must be a valid email address")
    private String email;

    /** 12-digit Aadhaar number (required for VISITOR entries) */
    @Pattern(regexp = "^\\d{12}$|^$", message = "aadhaarNumber must be exactly 12 digits")
    private String aadhaarNumber;

    /** Employee ID of the person to meet (from usermaster.employeeid) */
    @NotBlank(message = "personToMeetId is required")
    private String personToMeetId;

    /** Department — sent from frontend for display; server overwrites with DB value */
    private String department;

    /**
     * Office location ID the visitor/employee is visiting.
     * Must be a valid LocationId from locationmaster.
     */
    @NotBlank(message = "locationId is required")
    private String locationId;

    /** Free-text reason for the visit */
    private String reasonForVisit;

    /**
     * Requested appointment date in ISO-8601 format: yyyy-MM-dd
     * e.g. "2024-07-22"
     */
    @NotBlank(message = "appointmentDate is required")
    @Pattern(regexp = "^\\d{4}-\\d{2}-\\d{2}$", message = "appointmentDate must be yyyy-MM-dd")
    private String appointmentDate;

    /**
     * Requested appointment time slot label.
     * e.g. "10:00 AM", "11:00 AM", "01:00 PM"
     */
    @NotBlank(message = "appointmentTime is required")
    private String appointmentTime;
}
