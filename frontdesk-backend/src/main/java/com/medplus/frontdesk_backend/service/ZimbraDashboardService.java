package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.dto.zimbra.CalendarEventDto;
import com.medplus.frontdesk_backend.dto.zimbra.MailDto;
import com.medplus.frontdesk_backend.dto.zimbra.ZimbraDashboardResponseDto;
import com.medplus.frontdesk_backend.integration.ZimbraContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ZimbraDashboardService {

    private final ZimbraMailService zimbraMailService;
    private final ZimbraCalendarService zimbraCalendarService;

    public ZimbraDashboardResponseDto getDashboard() {
        long start = System.currentTimeMillis();
        String email = ZimbraContext.getEmail();

        List<MailDto> emails = zimbraMailService.getInbox(5);
        List<CalendarEventDto> events = zimbraCalendarService.getTodaysEvents();
        int unreadCount = zimbraMailService.getUnreadCount();

        log.info("[Zimbra] getDashboard email={} emails={} unread={} events={} latency={}ms",
                email, emails.size(), unreadCount, events.size(), System.currentTimeMillis() - start);

        return ZimbraDashboardResponseDto.builder()
                .emails(emails)
                .events(events)
                .unreadEmailCount(unreadCount)
                .build();
    }
}
