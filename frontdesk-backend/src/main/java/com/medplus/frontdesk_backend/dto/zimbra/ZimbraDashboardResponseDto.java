package com.medplus.frontdesk_backend.dto.zimbra;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class ZimbraDashboardResponseDto {
    private List<MailDto> emails;
    private List<CalendarEventDto> events;

    /** Total unread email count across the full inbox (not just the top 5 shown). */
    private int unreadEmailCount;
}
