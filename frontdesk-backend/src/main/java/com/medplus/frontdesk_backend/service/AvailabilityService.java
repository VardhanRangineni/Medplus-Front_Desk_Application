package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.repository.AppointmentRepository;
import com.medplus.frontdesk_backend.repository.BusySlotRepository;
import com.medplus.frontdesk_backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

/**
 * Central availability check used by the booking + reschedule flows and the
 * {@code /api/busy-slots} endpoints.
 *
 * <p>Returns {@code false} when the employee is already busy during
 * {@code [start, end)} because of:
 * <ul>
 *   <li>An active (PENDING / RESCHEDULED) appointment overlapping the window, or</li>
 *   <li>A {@code busy_slots} entry overlapping the window, or</li>
 *   <li>A Zimbra free/busy hit (best-effort — treated as advisory when Zimbra is down).</li>
 * </ul>
 *
 * <p>All three sources are checked because each represents a different kind
 * of commitment: internal bookings, manually-blocked personal time, and any
 * external calendar events the employee owns outside our system.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AvailabilityService {

    private final AppointmentRepository   appointmentRepository;
    private final BusySlotRepository      busySlotRepository;
    private final UserRepository          userRepository;
    private final ZimbraAppointmentService zimbraAppointmentService;

    /**
     * Availability check for a new booking.
     *
     * @param employeeId internal employee id ({@code usermaster.employeeid})
     * @param start      requested window start (inclusive)
     * @param end        requested window end   (exclusive)
     * @return {@code true} when the slot is free, {@code false} on any overlap
     */
    public boolean isAvailable(String employeeId, LocalDateTime start, LocalDateTime end) {
        return isAvailable(employeeId, start, end, null);
    }

    /**
     * Availability check variant used by reschedule — ignores the appointment
     * row being moved so it doesn't conflict with itself.
     *
     * @param excludeAppointmentId pass the ID of the appointment being moved,
     *                             or {@code null} for a fresh booking
     */
    public boolean isAvailable(String employeeId,
                               LocalDateTime start,
                               LocalDateTime end,
                               String excludeAppointmentId) {
        if (employeeId == null || start == null || end == null || !end.isAfter(start)) {
            return false;
        }

        // 1. Conflicting appointments in our own DB
        int appts = appointmentRepository.countActiveOverlapping(
                employeeId, start, end, excludeAppointmentId);
        if (appts > 0) {
            log.debug("[Availability] {} has {} overlapping appointment(s) at {}..{}",
                    employeeId, appts, start, end);
            return false;
        }

        // 2. Manual busy blocks
        int blocks = busySlotRepository.countOverlapping(employeeId, start, end);
        if (blocks > 0) {
            log.debug("[Availability] {} has {} overlapping busy-slot(s) at {}..{}",
                    employeeId, blocks, start, end);
            return false;
        }

        // 3. Zimbra free/busy (advisory — tolerate outage)
        String workEmail = userRepository.findUserMasterByEmployeeId(employeeId)
                .map(m -> m.getWorkemail())
                .filter(e -> e != null && !e.isBlank())
                .orElse(null);
        if (workEmail != null) {
            try {
                zimbraAppointmentService.checkEmployeeAvailability(workEmail, start, end);
            } catch (org.springframework.web.server.ResponseStatusException ex) {
                // 409 from Zimbra == calendar conflict. Treat as unavailable.
                log.debug("[Availability] Zimbra reports {} busy at {}..{}",
                        workEmail, start, end);
                return false;
            } catch (Exception ex) {
                // Zimbra unreachable — rely on DB + busy_slots only
                log.warn("[Availability] Zimbra check failed for {}: {}", workEmail, ex.getMessage());
            }
        }

        return true;
    }
}
