package com.medplus.frontdesk_backend.dto.zimbra;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request body for POST /zimbra/calendar/events/{inviteId}/respond
 */
@Data
@NoArgsConstructor
public class MeetingRespondRequestDto {

    /**
     * Participation status code:
     * <ul>
     *   <li>{@code AC} — Accept</li>
     *   <li>{@code DE} — Decline</li>
     *   <li>{@code TE} — Tentative</li>
     * </ul>
     */
    @NotBlank(message = "status is required")
    @Pattern(regexp = "^(AC|DE|TE)$", message = "status must be AC, DE, or TE")
    private String status;

    /**
     * Event start datetime string returned by the calendar API, e.g. {@code "2026-04-20 10:00"}.
     * Required when {@code status = DE} so the backend can find and free the slot in the DB.
     * Optional for AC / TE.
     */
    private String eventStart;
}
