package com.medplus.frontdesk_backend.dto.zimbra;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Internal transfer object passed to ZimbraSoapClient.createAppointment().
 * Never serialised to JSON — backend use only.
 */
@Data
@Builder
public class ZimbraEventRequestDto {

    /** Event title / subject line. */
    private String title;

    /** Plain-text event description. */
    private String description;

    /** Physical location of the meeting. */
    private String location;

    /** Start time (IST). */
    private LocalDateTime start;

    /** End time (IST). */
    private LocalDateTime end;

    /**
     * The organiser's email address — the service account
     * (noreply.calendar@medplusindia.com).
     */
    private String organizerEmail;

    /**
     * Attendee list.  Both the employee (internal) and visitor (external)
     * are added; Zimbra will send meeting invites to all of them.
     */
    private List<String> attendeeEmails;
}
