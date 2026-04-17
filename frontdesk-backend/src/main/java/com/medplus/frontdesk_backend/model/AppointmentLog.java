package com.medplus.frontdesk_backend.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * Represents a row in the appointmentslog table.
 * Records are created by the public booking web app and deleted after the visitor checks in.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AppointmentLog {

    /** Human-readable reference, e.g. APT-20260416-0001 */
    private String appointmentId;

    /** UUID used by the web app for polling confirmation */
    private String bookingToken;

    /** VISITOR (default) or EMPLOYEE */
    private String entryType;

    /** Patient / visitor full name */
    private String name;

    private String aadhaarNumber;
    private String email;
    private String mobile;

    /** Employee ID — only for EMPLOYEE entry type */
    private String empId;

    /** employeeid of the doctor / host */
    private String personToMeet;

    /** Full name of doctor / host (denormalised for display) */
    private String personName;

    private String department;
    private String locationId;
    private String locationName;

    private LocalDate appointmentDate;
    private LocalTime appointmentTime;

    private String reasonForVisit;
    private LocalDateTime createdAt;
}
