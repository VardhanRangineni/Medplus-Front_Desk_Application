package com.medplus.frontdesk_backend.dto.zimbra;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class CalendarEventDto {
    private String id;

    /**
     * Zimbra invite message ID — required for SendInviteReplyRequest.
     * Distinct from {@code id} (the calendar item ID).
     */
    private String invId;

    private String title;
    private String start;
    private String end;
    private String location;
    private boolean allDay;

    /**
     * Participation status.  Possible values returned by Zimbra:
     * <ul>
     *   <li>{@code NE} — Needs action (no response yet)</li>
     *   <li>{@code AC} — Accepted</li>
     *   <li>{@code DE} — Declined</li>
     *   <li>{@code TE} — Tentative</li>
     * </ul>
     */
    private String ptst;
}
