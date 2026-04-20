package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.dto.BusySlotRequestDto;
import com.medplus.frontdesk_backend.dto.zimbra.ZimbraEventRequestDto;
import com.medplus.frontdesk_backend.integration.ZimbraSoapClient;
import com.medplus.frontdesk_backend.model.BusySlot;
import com.medplus.frontdesk_backend.repository.BusySlotRepository;
import com.medplus.frontdesk_backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * BusySlotService
 *
 * <p>Creates / lists / removes employee-owned busy blocks. Can optionally
 * mirror the block as a "Busy" Zimbra calendar event so other systems
 * (or the free/busy lookup) see it too.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BusySlotService {

    private final BusySlotRepository         busySlotRepository;
    private final AvailabilityService        availabilityService;
    private final UserRepository             userRepository;
    private final ZimbraServiceAccountSession serviceAccountSession;
    private final ZimbraSoapClient           zimbraSoapClient;

    // ── Create ────────────────────────────────────────────────────────────────

    /**
     * Blocks a window on {@code employeeId}'s calendar.
     *
     * @param req         validated request body
     * @param fallbackOwner employee id to use when {@code req.employeeId} is blank
     *                      (typically the JWT subject — the employee booking themselves)
     * @return the persisted {@link BusySlot}
     */
    public BusySlot create(BusySlotRequestDto req, String fallbackOwner) {
        LocalDateTime start = parseLocal(req.getStartTime(), "startTime");
        LocalDateTime end   = parseLocal(req.getEndTime(),   "endTime");
        if (!end.isAfter(start)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "endTime must be strictly after startTime");
        }

        String employeeId = (req.getEmployeeId() != null && !req.getEmployeeId().isBlank())
                ? req.getEmployeeId().trim()
                : fallbackOwner;
        if (employeeId == null || employeeId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "employeeId is required");
        }

        // Overlap check — keep busy slots exclusive so the free/busy view stays clean
        if (!availabilityService.isAvailable(employeeId, start, end)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Employee is already busy during the requested window.");
        }

        BusySlot slot = BusySlot.builder()
                .id         (UUID.randomUUID().toString())
                .employeeId (employeeId)
                .startTime  (start)
                .endTime    (end)
                .reason     (req.getReason())
                .createdBy  (fallbackOwner)
                .build();
        busySlotRepository.insert(slot);

        // Optional: push to Zimbra as a "Busy" event (best-effort)
        if (req.isSyncToZimbra()) {
            trySyncToZimbra(slot);
        }

        log.info("[BusySlot] {} blocked {}..{} reason='{}'",
                employeeId, start, end, slot.getReason());
        return slot;
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    public List<BusySlot> listForEmployee(String employeeId, LocalDateTime from, LocalDateTime to) {
        if (employeeId == null || employeeId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "employeeId is required");
        }
        return busySlotRepository.findByEmployeeInRange(employeeId, from, to);
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    /**
     * Removes a busy block. The caller's id (JWT subject) is checked so
     * employees cannot delete someone else's block.
     */
    public void delete(String id, String callerEmployeeId) {
        Optional<BusySlot> found = busySlotRepository.findById(id);
        BusySlot slot = found.orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND, "Busy slot not found: " + id));

        if (callerEmployeeId != null
                && !callerEmployeeId.equalsIgnoreCase(slot.getEmployeeId())
                && !callerEmployeeId.equalsIgnoreCase(slot.getCreatedBy())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "You can only remove busy blocks you own.");
        }

        // Cancel the mirrored Zimbra event if we had one
        if (slot.getZimbraEventId() != null && !slot.getZimbraEventId().isBlank()) {
            try {
                zimbraSoapClient.cancelAppointment(serviceAccountSession.getToken(),
                        slot.getZimbraEventId());
            } catch (Exception ex) {
                log.warn("[BusySlot] Zimbra cancel failed for invId={}: {}",
                        slot.getZimbraEventId(), ex.getMessage());
            }
        }

        busySlotRepository.deleteById(id);
        log.info("[BusySlot] Removed {} for employee={}", id, slot.getEmployeeId());
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Best-effort push of a busy block to the employee's Zimbra calendar as a
     * "Busy" event. A failure here is logged but never blocks the DB insert —
     * the internal busy block is the source of truth for our availability
     * check; Zimbra sync is a nice-to-have.
     */
    private void trySyncToZimbra(BusySlot slot) {
        String email = userRepository.findUserMasterByEmployeeId(slot.getEmployeeId())
                .map(m -> m.getWorkemail())
                .filter(e -> e != null && !e.isBlank())
                .orElse(null);
        if (email == null) {
            log.debug("[BusySlot] No work email for {} — skipping Zimbra sync", slot.getEmployeeId());
            return;
        }

        try {
            String title = "Busy" + (slot.getReason() != null && !slot.getReason().isBlank()
                    ? " — " + slot.getReason() : "");
            ZimbraEventRequestDto event = ZimbraEventRequestDto.builder()
                    .title(title)
                    .description("Auto-generated from Front Desk busy-slot block")
                    .location("")
                    .start(slot.getStartTime())
                    .end(slot.getEndTime())
                    .organizerEmail(serviceAccountSession.getEmail())
                    .attendeeEmails(List.of(email))
                    .build();

            Document doc = zimbraSoapClient.createAppointment(
                    serviceAccountSession.getToken(), event);
            String invId = extractInvId(doc);
            if (invId != null && !invId.isBlank()) {
                busySlotRepository.setZimbraEventId(slot.getId(), invId);
                slot.setZimbraEventId(invId);
            }
            log.info("[BusySlot] Synced {} to Zimbra as invId={}", slot.getId(), invId);
        } catch (Exception ex) {
            log.warn("[BusySlot] Zimbra sync failed for slot={}: {}", slot.getId(), ex.getMessage());
        }
    }

    private static String extractInvId(Document doc) {
        NodeList nodes = doc.getElementsByTagName("CreateAppointmentResponse");
        if (nodes.getLength() > 0 && nodes.item(0) instanceof Element el) {
            return el.getAttribute("invId");
        }
        return null;
    }

    private static LocalDateTime parseLocal(String iso, String field) {
        try { return LocalDateTime.parse(iso.trim()); }
        catch (DateTimeParseException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    field + " must be ISO-8601 (e.g. 2026-04-25T14:30:00)");
        }
    }
}
