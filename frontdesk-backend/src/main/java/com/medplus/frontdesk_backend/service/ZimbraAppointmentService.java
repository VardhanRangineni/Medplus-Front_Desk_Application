package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.dto.zimbra.ZimbraEventRequestDto;
import com.medplus.frontdesk_backend.exception.ZimbraException;
import com.medplus.frontdesk_backend.integration.ZimbraSoapClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

/**
 * ZimbraAppointmentService
 *
 * Orchestrates visitor appointment creation in Zimbra:
 * <ol>
 *   <li>Authenticates as the service account (token cached by ZimbraServiceAccountSession)</li>
 *   <li>Calls GetFreeBusyRequest to detect calendar conflicts — <b>hard reject</b> on conflict</li>
 *   <li>Calls CreateAppointmentRequest — Zimbra sends meeting invites to employee + visitor</li>
 * </ol>
 *
 * Zimbra is the SINGLE SOURCE OF TRUTH for calendar events.
 * This service never queries the internal DB for availability.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ZimbraAppointmentService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    private final ZimbraSoapClient          zimbraSoapClient;
    private final ZimbraServiceAccountSession serviceAccountSession;

    /**
     * Returns the employee's busy time periods from Zimbra for an entire day.
     *
     * <p>Used by the slot-availability check so that <b>declined</b> invites are
     * automatically reflected as free slots — Zimbra removes the attendee from
     * the busy list when they decline a meeting.
     *
     * @param employeeEmail employee's Zimbra work email
     * @param date          the date to check (IST)
     * @return list of {@code [startEpochMs, endEpochMs]} pairs for all busy blocks;
     *         {@code null} when Zimbra is unreachable (caller should fall back to DB)
     */
    public List<long[]> getEmployeeBusyPeriods(String employeeEmail, LocalDate date) {
        try {
            String token    = serviceAccountSession.getToken();
            long   dayStart = date.atStartOfDay(IST).toInstant().toEpochMilli();
            long   dayEnd   = date.plusDays(1).atStartOfDay(IST).toInstant().toEpochMilli();

            Document doc = zimbraSoapClient.getFreeBusy(token, employeeEmail, dayStart, dayEnd);

            List<long[]> periods = new ArrayList<>();
            NodeList busyNodes = doc.getElementsByTagName("b");
            for (int i = 0; i < busyNodes.getLength(); i++) {
                if (busyNodes.item(i) instanceof Element b) {
                    String s = b.getAttribute("s");
                    String e = b.getAttribute("e");
                    if (!s.isBlank() && !e.isBlank()) {
                        try { periods.add(new long[]{ Long.parseLong(s), Long.parseLong(e) }); }
                        catch (NumberFormatException ignored) {}
                    }
                }
            }
            log.debug("[ZimbraFreeBusy] {} on {}: {} busy period(s)", employeeEmail, date, periods.size());
            return periods;

        } catch (Exception ex) {
            log.warn("[ZimbraFreeBusy] Could not fetch free/busy for {} on {}: {}",
                    employeeEmail, date, ex.getMessage());
            return null; // null = "Zimbra unavailable, caller falls back to DB"
        }
    }

    /**
     * Standalone conflict check — call this BEFORE persisting to the DB.
     * Throws 409 CONFLICT when the employee's Zimbra calendar is busy.
     * Silently passes if Zimbra is unreachable (best-effort; DB remains gating mechanism).
     */
    public void checkEmployeeAvailability(String employeeEmail, LocalDateTime start, LocalDateTime end) {
        if (employeeEmail == null || employeeEmail.isBlank()) return;
        String token = serviceAccountSession.getToken();
        long startMs = start.atZone(IST).toInstant().toEpochMilli();
        long endMs   = end.atZone(IST).toInstant().toEpochMilli();
        assertNoConflict(token, employeeEmail, startMs, endMs, start);
    }

    /**
     * Creates a visitor appointment event in Zimbra.
     *
     * @param employeeEmail employee's work email (internal Zimbra user)
     * @param visitorEmail  visitor's email (external; may be null)
     * @param visitorName   visitor's full name
     * @param department    employee's department (for event title)
     * @param locationName  office location name (shown as event location)
     * @param reason        reason for visit (appended to description)
     * @param start         appointment start time (IST)
     * @param end           appointment end time (IST)
     * @return Zimbra invite ID (invId) — stored in booking for reference
     * @throws ResponseStatusException 409 CONFLICT when employee calendar is busy
     */
    public String createVisitorAppointment(
            String employeeEmail,
            String visitorEmail,
            String visitorName,
            String department,
            String locationName,
            String reason,
            LocalDateTime start,
            LocalDateTime end) {

        String token = serviceAccountSession.getToken();

        // ── 1. Free/busy conflict check ───────────────────────────────────────
        long startMs = start.atZone(IST).toInstant().toEpochMilli();
        long endMs   = end.atZone(IST).toInstant().toEpochMilli();
        assertNoConflict(token, employeeEmail, startMs, endMs, start);

        // ── 2. Build attendees list ───────────────────────────────────────────
        List<String> attendees = new ArrayList<>();
        attendees.add(employeeEmail);
        if (visitorEmail != null && !visitorEmail.isBlank()) {
            attendees.add(visitorEmail.trim());
        }

        // ── 3. Build event ────────────────────────────────────────────────────
        String title = "Visitor Meeting - %s (%s)".formatted(visitorName, department);
        String description = buildDescription(visitorName, department, reason);

        ZimbraEventRequestDto event = ZimbraEventRequestDto.builder()
                .title(title)
                .description(description)
                .location(locationName)
                .start(start)
                .end(end)
                .organizerEmail(serviceAccountSession.getEmail())
                .attendeeEmails(attendees)
                .build();

        // ── 4. Create appointment ─────────────────────────────────────────────
        long t0 = System.currentTimeMillis();
        Document doc = zimbraSoapClient.createAppointment(token, event);
        long elapsed = System.currentTimeMillis() - t0;

        String inviteId = extractAttribute(doc, "CreateAppointmentResponse", "invId");
        String calItemId = extractAttribute(doc, "CreateAppointmentResponse", "calItemId");

        log.info("[ZimbraAppointment] Event created in {}ms | title='{}' | employee={} | visitor={} | invId={} | calItemId={}",
                elapsed, title, employeeEmail, visitorEmail, inviteId, calItemId);

        return inviteId;
    }

    /**
     * Checks employee's Zimbra calendar for any conflicting busy slot.
     * Throws 409 CONFLICT on overlap; logs and continues on Zimbra error
     * (free/busy check failure must NOT block booking — service may be temporarily unavailable).
     */
    private void assertNoConflict(String token, String employeeEmail,
                                   long startMs, long endMs, LocalDateTime startLocal) {
        if (employeeEmail == null || employeeEmail.isBlank()) return;

        try {
            long t0 = System.currentTimeMillis();
            Document doc = zimbraSoapClient.getFreeBusy(token, employeeEmail, startMs, endMs);
            log.debug("[ZimbraFreeBusy] Checked {} in {}ms", employeeEmail, System.currentTimeMillis() - t0);

            // <b s="..." e="..."/> elements represent busy blocks
            NodeList busyNodes = doc.getElementsByTagName("b");
            if (busyNodes.getLength() > 0) {
                log.warn("[ZimbraFreeBusy] Conflict detected for {} at {}", employeeEmail, startLocal);
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "The selected time slot is already booked in the employee's calendar. "
                        + "Please choose a different time.");
            }

        } catch (ResponseStatusException re) {
            throw re;    // propagate 409 directly
        } catch (ZimbraException ze) {
            // Free/busy unavailable — log and allow booking to proceed
            log.warn("[ZimbraFreeBusy] Could not check calendar for {}: {}", employeeEmail, ze.getMessage());
        } catch (Exception ex) {
            log.warn("[ZimbraFreeBusy] Unexpected error checking calendar for {}: {}", employeeEmail, ex.getMessage());
        }
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private static String buildDescription(String visitorName, String department, String reason) {
        StringBuilder sb = new StringBuilder("Appointment booked via Front Desk System\n\n");
        sb.append("Visitor   : ").append(visitorName).append("\n");
        sb.append("Department: ").append(department).append("\n");
        if (reason != null && !reason.isBlank()) {
            sb.append("Reason    : ").append(reason).append("\n");
        }
        return sb.toString();
    }

    /** Extracts a named attribute from the first occurrence of the given element. */
    private static String extractAttribute(Document doc, String tagName, String attrName) {
        NodeList nodes = doc.getElementsByTagName(tagName);
        if (nodes.getLength() > 0) {
            var node = nodes.item(0);
            if (node instanceof org.w3c.dom.Element el) {
                return el.getAttribute(attrName);
            }
        }
        return "";
    }
}
