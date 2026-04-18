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
}
