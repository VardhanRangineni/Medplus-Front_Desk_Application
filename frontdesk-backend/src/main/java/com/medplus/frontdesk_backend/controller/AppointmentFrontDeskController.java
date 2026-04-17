package com.medplus.frontdesk_backend.controller;

import com.medplus.frontdesk_backend.dto.ApiResponse;
import com.medplus.frontdesk_backend.dto.VisitorResponseDto;
import com.medplus.frontdesk_backend.service.AppointmentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * AppointmentFrontDeskController — authenticated endpoints for the front-desk
 * Electron desktop application.
 *
 * All routes require a valid JWT (enforced by SecurityConfig).
 *
 * Endpoints:
 *   GET  /api/appointments                           – paginated list (default: today from now)
 *   GET  /api/appointments/search                    – full-text search
 *   GET  /api/appointments/{id}/card-preview         – peek next card without assigning
 *   POST /api/appointments/{id}/checkin              – atomic check-in (create visitor + delete appt)
 */
@Slf4j
@RestController
@RequestMapping("/api/appointments")
@RequiredArgsConstructor
public class AppointmentFrontDeskController {

    private final AppointmentService appointmentService;

    // ── List ──────────────────────────────────────────────────────────────────

    /**
     * Returns a paginated list of appointments with DB-level filtering.
     *
     * <pre>
     * GET /api/appointments
     *   ?defaultView=true  (default true — shows today from current time onwards)
     *   &page=0
     *   &size=20
     *   &from=2026-04-16   (overrides defaultView when set)
     *   &to=2026-04-16
     *   &locationId=xxx    (admin-level override; receptionists see their location)
     * </pre>
     */
    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> listAppointments(
            @RequestParam(defaultValue = "true")  boolean defaultView,
            @RequestParam(defaultValue = "0")     int     page,
            @RequestParam(defaultValue = "20")    int     size,
            @RequestParam(required = false)       String  from,
            @RequestParam(required = false)       String  to,
            @RequestParam(required = false)       String  locationId,
            Authentication auth) {

        String callerLocationId = resolveLocationFilter(locationId, auth);
        Map<String, Object> result = appointmentService.listAppointments(
                defaultView, page, size, null, from, to, callerLocationId);
        return ResponseEntity.ok(ApiResponse.success("Appointments loaded.", result));
    }

    /**
     * Full-text search variant — same filters as GET /api/appointments plus a search term.
     *
     * <pre>
     * GET /api/appointments/search?q=John&defaultView=false&from=2026-04-01&to=2026-04-30
     * </pre>
     */
    @GetMapping("/search")
    public ResponseEntity<ApiResponse<Map<String, Object>>> searchAppointments(
            @RequestParam(defaultValue = "")      String  q,
            @RequestParam(defaultValue = "false") boolean defaultView,
            @RequestParam(defaultValue = "0")     int     page,
            @RequestParam(defaultValue = "20")    int     size,
            @RequestParam(required = false)       String  from,
            @RequestParam(required = false)       String  to,
            @RequestParam(required = false)       String  locationId,
            Authentication auth) {

        String callerLocationId = resolveLocationFilter(locationId, auth);
        Map<String, Object> result = appointmentService.listAppointments(
                defaultView, page, size, q, from, to, callerLocationId);
        return ResponseEntity.ok(ApiResponse.success("Search results.", result));
    }

    // ── Card preview ──────────────────────────────────────────────────────────

    /**
     * Returns the appointment details and the next available card code WITHOUT
     * assigning the card.  Called when the receptionist clicks the "Check In"
     * button to populate the confirmation modal.
     *
     * <pre>
     * GET /api/appointments/APT-20260416-0001/card-preview
     * Authorization: Bearer &lt;jwt&gt;
     * </pre>
     *
     * Response:
     * <pre>
     * {
     *   "success": true,
     *   "data": {
     *     "appointment": { ... AppointmentListItemDto ... },
     *     "nextCardCode": "HO-VISITOR-3"   (null if no cards available)
     *   }
     * }
     * </pre>
     */
    @GetMapping("/{appointmentId}/card-preview")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getCardPreview(
            @PathVariable String appointmentId,
            Authentication auth) {

        Map<String, Object> preview =
                appointmentService.getCheckInPreview(appointmentId, auth.getName());
        return ResponseEntity.ok(ApiResponse.success("Check-in preview ready.", preview));
    }

    // ── Atomic check-in ───────────────────────────────────────────────────────

    /**
     * Atomically checks in an appointment:
     * <ol>
     *   <li>Auto-assigns a card from cardmaster (same logic as manual check-in).</li>
     *   <li>Inserts a new row in {@code visitorlog} with Status = CHECKED_IN.</li>
     *   <li>Deletes the row from {@code appointmentslog}.</li>
     * </ol>
     * The patient now appears on the Check-In / Check-Out page and can be
     * checked out later.
     *
     * <pre>
     * POST /api/appointments/APT-20260416-0001/checkin
     * Authorization: Bearer &lt;jwt&gt;
     * </pre>
     *
     * Success (200):
     * <pre>
     * {
     *   "success": true,
     *   "data": {
     *     "id": "MED-V-0042",
     *     "name": "John Doe",
     *     "cardCode": "HO-VISITOR-3",
     *     "status": "checked-in",
     *     ...
     *   }
     * }
     * </pre>
     */
    @PostMapping("/{appointmentId}/checkin")
    public ResponseEntity<ApiResponse<VisitorResponseDto>> checkIn(
            @PathVariable String appointmentId,
            Authentication auth) {

        VisitorResponseDto visitor =
                appointmentService.performCheckIn(appointmentId, auth.getName());
        return ResponseEntity.ok(ApiResponse.success("Patient checked in successfully.", visitor));
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * When a non-null locationId is explicitly passed by an admin, use it.
     * Otherwise, pass null (AppointmentService will not restrict by location).
     * Receptionists typically call without locationId; the service can apply
     * their home location if needed in future.
     */
    private static String resolveLocationFilter(String requested, Authentication auth) {
        return (requested != null && !requested.isBlank()) ? requested : null;
    }
}
