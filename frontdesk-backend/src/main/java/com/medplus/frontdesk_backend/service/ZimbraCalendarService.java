package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.config.ZimbraCache;
import com.medplus.frontdesk_backend.dto.zimbra.CalendarEventDto;
import com.medplus.frontdesk_backend.integration.ZimbraContext;
import com.medplus.frontdesk_backend.integration.ZimbraSoapClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.w3c.dom.*;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ZimbraCalendarService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final DateTimeFormatter DT_FMT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm").withZone(IST);

    private final ZimbraSoapClient zimbraSoapClient;
    private final ZimbraCache cache;

    public List<CalendarEventDto> getEvents(String fromDate, String toDate) {
        String email = ZimbraContext.getEmail();
        String cacheKey = cache.key(email, "calendar",
                fromDate != null ? fromDate : "null",
                toDate   != null ? toDate   : "null");

        return cache.<List<CalendarEventDto>>get(cacheKey).orElseGet(() -> {
            long start = System.currentTimeMillis();
            Long startMs = parseDate(fromDate, true);
            Long endMs   = parseDate(toDate,   false);
            Document doc = zimbraSoapClient.searchCalendar(ZimbraContext.getAuthToken(), startMs, endMs);
            List<CalendarEventDto> result = parseAppointments(doc);
            log.info("[Zimbra] getEvents email={} count={} latency={}ms",
                    email, result.size(), System.currentTimeMillis() - start);
            cache.put(cacheKey, result);
            return result;
        });
    }

    public List<CalendarEventDto> getTodaysEvents() {
        LocalDate today = LocalDate.now(IST);
        return getEvents(today.toString(), today.toString());
    }

    // ── parsers ──────────────────────────────────────────────────────────────

    private List<CalendarEventDto> parseAppointments(Document doc) {
        List<CalendarEventDto> result = new ArrayList<>();
        NodeList appts = doc.getElementsByTagName("appt");

        for (int i = 0; i < appts.getLength(); i++) {
            Element appt = (Element) appts.item(i);
            String id       = attr(appt, "id");
            String title    = attr(appt, "name");
            String location = attr(appt, "loc");
            boolean allDay  = "1".equals(attr(appt, "allDay"));

            NodeList insts = appt.getElementsByTagName("inst");
            if (insts.getLength() > 0) {
                Element inst = (Element) insts.item(0);
                String startMs = attr(inst, "s");
                String durMs   = attr(inst, "dur");
                result.add(CalendarEventDto.builder()
                        .id(id).title(title).location(location).allDay(allDay)
                        .start(formatEpochMs(startMs))
                        .end(computeEnd(startMs, durMs))
                        .build());
            } else {
                result.add(CalendarEventDto.builder()
                        .id(id).title(title).location(location).allDay(allDay)
                        .start("").end("").build());
            }
        }
        return result;
    }

    private String computeEnd(String startMs, String durMs) {
        if (startMs.isBlank() || durMs.isBlank()) return "";
        try { return formatEpochMs(String.valueOf(Long.parseLong(startMs) + Long.parseLong(durMs))); }
        catch (NumberFormatException e) { return ""; }
    }

    private String formatEpochMs(String epochMs) {
        if (epochMs == null || epochMs.isBlank()) return "";
        try { return DT_FMT.format(Instant.ofEpochMilli(Long.parseLong(epochMs))); }
        catch (NumberFormatException e) { return epochMs; }
    }

    private Long parseDate(String dateStr, boolean startOfDay) {
        if (dateStr == null || dateStr.isBlank()) return null;
        try {
            LocalDate d = LocalDate.parse(dateStr);
            ZonedDateTime zdt = startOfDay
                    ? d.atStartOfDay(IST)
                    : d.plusDays(1).atStartOfDay(IST).minusNanos(1);
            return zdt.toInstant().toEpochMilli();
        } catch (Exception e) {
            log.warn("Cannot parse date '{}': {}", dateStr, e.getMessage());
            return null;
        }
    }

    private String attr(Element el, String name) {
        String v = el.getAttribute(name); return v == null ? "" : v;
    }
}
