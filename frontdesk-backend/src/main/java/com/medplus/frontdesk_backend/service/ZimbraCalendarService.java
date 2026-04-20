package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.config.ZimbraCache;
import com.medplus.frontdesk_backend.dto.zimbra.CalendarEventDto;
import com.medplus.frontdesk_backend.integration.ZimbraContext;
import com.medplus.frontdesk_backend.integration.ZimbraSoapClient;
import com.medplus.frontdesk_backend.repository.AppointmentRepository;
import com.medplus.frontdesk_backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.w3c.dom.*;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class ZimbraCalendarService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final DateTimeFormatter DT_FMT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm").withZone(IST);
    private static final DateTimeFormatter SLOT_FMT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final ZimbraSoapClient     zimbraSoapClient;
    private final ZimbraCache          cache;
    private final UserRepository       userRepository;
    private final AppointmentRepository appointmentRepository;

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

    /**
     * Responds to a Zimbra meeting invite on behalf of the currently
     * authenticated employee.
     *
     * <p>Uses the employee's own {@code authToken} (from {@link ZimbraContext}),
     * NOT the service account — so the reply is sent from their mailbox.
     *
     * <p>After a successful reply the calendar cache is cleared so the
     * refreshed {@code ptst} value is visible immediately.
     *
     * @param inviteId Zimbra invite message ID ({@code invId} from the event DTO)
     * @param status   participation code: {@code AC}, {@code DE}, or {@code TE}
     * @return the updated event DTO with the new {@code ptst} value
     */
    public CalendarEventDto respondToMeeting(String inviteId, String status, String eventStart) {
        if (inviteId == null || inviteId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "inviteId is required");
        }

        String authToken = ZimbraContext.getAuthToken();
        String email     = ZimbraContext.getEmail();

        Set<String> valid = Set.of("AC", "DE", "TE");
        String upperStatus = status.toUpperCase();
        if (!valid.contains(upperStatus)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "status must be AC, DE, or TE — got: " + status);
        }

        long t0 = System.currentTimeMillis();
        zimbraSoapClient.sendInviteReply(authToken, inviteId, upperStatus);
        log.info("[Zimbra] respondToMeeting inviteId={} status={} email={} latency={}ms",
                inviteId, upperStatus, email, System.currentTimeMillis() - t0);

        // Evict calendar cache so the next getEvents() call returns fresh ptst values
        cache.evictByPrefix(email + ":calendar");

        // ── On DECLINE: free the slot in appointmentslog ──────────────────────
        // This ensures the booking web-app immediately shows the slot as available
        // without depending on Zimbra free/busy API availability.
        if ("DE".equals(upperStatus) && eventStart != null && !eventStart.isBlank()) {
            freeSlotsOnDecline(email, eventStart);
        }

        return CalendarEventDto.builder()
                .invId(inviteId)
                .ptst(upperStatus)
                .build();
    }

    /**
     * Deletes the appointment from {@code appointmentslog} that matches the
     * employee (by their Zimbra email → employeeid lookup) and the declined slot.
     *
     * @param employeeEmail  Zimbra email of the declining employee
     * @param eventStart     event start string from the calendar DTO, e.g. "2026-04-20 10:00"
     */
    private void freeSlotsOnDecline(String employeeEmail, String eventStart) {
        try {
            LocalDateTime dt = LocalDateTime.parse(eventStart.trim(), SLOT_FMT);
            LocalDate slotDate = dt.toLocalDate();
            LocalTime slotTime = dt.toLocalTime();

            String employeeId = userRepository.findUserMasterByWorkemail(employeeEmail)
                    .map(m -> m.getEmployeeid())
                    .orElse(null);

            if (employeeId == null) {
                log.warn("[ZimbraDecline] No employee found for email={}", employeeEmail);
                return;
            }

            int deleted = appointmentRepository.deleteByPersonAndSlot(employeeId, slotDate, slotTime);
            log.info("[ZimbraDecline] Freed {} slot(s) for employee={} on {} at {}",
                    deleted, employeeId, slotDate, slotTime);

        } catch (Exception ex) {
            log.warn("[ZimbraDecline] Could not free slot for email={} eventStart={}: {}",
                    employeeEmail, eventStart, ex.getMessage());
        }
    }

    // ── parsers ──────────────────────────────────────────────────────────────

    private List<CalendarEventDto> parseAppointments(Document doc) {
        List<CalendarEventDto> result = new ArrayList<>();
        NodeList appts = doc.getElementsByTagName("appt");

        for (int i = 0; i < appts.getLength(); i++) {
            Element appt = (Element) appts.item(i);
            String id       = attr(appt, "id");
            String invId    = attr(appt, "invId");
            String title    = attr(appt, "name");
            String location = attr(appt, "loc");
            boolean allDay  = "1".equals(attr(appt, "allDay"));

            // ptst is on the <appt> element itself or on the first <inst> child
            String ptst = attr(appt, "ptst");
            NodeList insts = appt.getElementsByTagName("inst");
            if (ptst.isBlank() && insts.getLength() > 0) {
                ptst = attr((Element) insts.item(0), "ptst");
            }
            if (ptst.isBlank()) ptst = "NE";

            // Skip declined events — keeps both the calendar view and the
            // dashboard summary count consistent (no "ghost" badge numbers)
            if ("DE".equals(ptst)) continue;

            if (insts.getLength() > 0) {
                Element inst = (Element) insts.item(0);
                String startMs = attr(inst, "s");
                String durMs   = attr(inst, "dur");
                result.add(CalendarEventDto.builder()
                        .id(id).invId(invId).title(title).location(location)
                        .allDay(allDay).ptst(ptst)
                        .start(formatEpochMs(startMs))
                        .end(computeEnd(startMs, durMs))
                        .build());
            } else {
                result.add(CalendarEventDto.builder()
                        .id(id).invId(invId).title(title).location(location)
                        .allDay(allDay).ptst(ptst)
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
