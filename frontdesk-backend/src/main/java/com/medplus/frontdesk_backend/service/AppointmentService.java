package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.dto.*;
import com.medplus.frontdesk_backend.model.AppointmentLog;
import com.medplus.frontdesk_backend.model.Location;
import com.medplus.frontdesk_backend.model.UserManagement;
import com.medplus.frontdesk_backend.model.UserMaster;
import com.medplus.frontdesk_backend.model.UserStatus;
import com.medplus.frontdesk_backend.repository.AppointmentRepository;
import com.medplus.frontdesk_backend.repository.LocationRepository;
import com.medplus.frontdesk_backend.repository.UserRepository;
import com.medplus.frontdesk_backend.repository.VisitorRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.NoSuchElementException;
import java.util.UUID;

/**
 * AppointmentService — business logic for appointment booking (public web app)
 * and front-desk check-in operations.
 *
 * All bookings are now persisted in the {@code appointmentslog} database table.
 * Check-in atomically moves the record into {@code visitorlog} and deletes it
 * from {@code appointmentslog} within a single transaction.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AppointmentService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private final OtpService                otpService;
    private final VisitorRepository         visitorRepository;
    private final UserRepository            userRepository;
    private final LocationRepository        locationRepository;
    private final AppointmentRepository     appointmentRepository;
    private final VisitorService            visitorService;
    private final CardService               cardService;
    private final ZimbraAppointmentService  zimbraAppointmentService;

    // ── OTP — Visitor (mobile-based) ─────────────────────────────────────────

    public OtpSendResponseDto sendVisitorOtp(String mobile) {
        otpService.revokeVisitorBookingAuth(mobile);
        return otpService.sendOtp(mobile);
    }

    public OtpVerifyResponseDto verifyVisitorOtp(String mobile, String otp) {
        OtpVerifyResponseDto r = otpService.verifyOtp(mobile, otp);
        if (r.isVerified()) {
            otpService.grantVisitorBookingAuth(mobile);
        }
        return r;
    }

    // ── Employee lookup + OTP ─────────────────────────────────────────────────

    /**
     * Looks up an employee by ID from the {@code usermaster} table (HR master — contains
     * ALL company employees, not just those with a front-desk system account) and dispatches
     * an OTP to their registered phone number.
     */
    public EmployeeLookupResponseDto lookupEmployeeAndSendOtp(String empId) {

        // Primary source: usermaster (HR master — all company employees)
        UserMaster master = userRepository.findUserMasterByEmployeeId(empId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Employee ID not found. Please check your ID and try again."));

        String phone      = master.getPhone();
        String department = master.getDepartment();
        String name       = master.getFullName();

        if (phone == null || phone.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "No registered phone number found for this employee. Please contact HR.");
        }

        otpService.revokeEmployeeBookingAuth(empId);
        OtpSendResponseDto otpResult = otpService.sendOtp(phone);
        if (!otpResult.isSuccess()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to send OTP. Please try again.");
        }

        log.info("[Appointment] OTP dispatched for employee {} ({}) to phone ending ...{}",
                empId, name, last4(phone));

        return EmployeeLookupResponseDto.builder()
                .found(true)
                .employee(EmployeeLookupResponseDto.EmployeeInfo.builder()
                        .id(master.getEmployeeid())
                        .name(name)
                        .department(department)
                        .maskedPhone(maskPhone(phone))
                        .build())
                .build();
    }

    public OtpVerifyResponseDto verifyEmployeeOtp(String empId, String otp) {
        // Resolve phone from usermaster (same table used during lookup)
        UserMaster master = userRepository.findUserMasterByEmployeeId(empId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Employee ID not found."));

        String phone = master.getPhone();
        if (phone == null || phone.isBlank()) {
            return new OtpVerifyResponseDto(false,
                    "No phone on record for this employee. Cannot verify OTP.");
        }
        OtpVerifyResponseDto r = otpService.verifyOtp(phone, otp);
        if (r.isVerified()) {
            otpService.grantEmployeeBookingAuth(empId);
        }
        return r;
    }

    // ── Office locations ──────────────────────────────────────────────────────

    public List<Location> getLocations() {
        return locationRepository.findAllActive();
    }

    // ── Employee search (public) ──────────────────────────────────────────────

    /**
     * Searches employees by name / ID / department.
     * When {@code locationId} is provided, results are restricted to that location.
     */
    public List<PersonToMeetDto> searchEmployees(String query, String locationId) {
        if (query == null || query.trim().length() < 2) return List.of();
        return visitorRepository.searchAllPersonsPublic(query.trim(), locationId);
    }

    /** Convenience overload — no location filter. */
    public List<PersonToMeetDto> searchEmployees(String query) {
        return searchEmployees(query, null);
    }

    // ── Time slots ────────────────────────────────────────────────────────────

    /**
     * Returns available booking slots for a given date and employee.
     *
     * <p><b>Availability strategy — Zimbra is the source of truth:</b>
     * <ol>
     *   <li>Fetch the employee's Zimbra free/busy for the day (via service account).</li>
     *   <li>If Zimbra responds: a slot is <em>available</em> when Zimbra shows the
     *       employee as <em>free</em> for that 30-minute window.  Declined invites are
     *       automatically freed because Zimbra removes the attendee from their busy list
     *       on decline.</li>
     *   <li>If Zimbra is unreachable: fall back to the internal DB ({@code appointmentslog})
     *       to prevent double-booking.</li>
     * </ol>
     */
    public List<AppointmentSlotDto> getAvailableSlots(String dateStr, String personToMeetId) {
        validateDate(dateStr);

        LocalDate date = LocalDate.parse(dateStr, DATE_FMT);

        // ── Try Zimbra free/busy (primary source of truth) ────────────────────
        String employeeEmail = userRepository.findUserMasterByEmployeeId(personToMeetId)
                .map(UserMaster::getWorkemail)
                .filter(e -> e != null && !e.isBlank())
                .orElse(null);

        List<long[]> zimbraBusy = null;
        if (employeeEmail != null) {
            zimbraBusy = zimbraAppointmentService.getEmployeeBusyPeriods(employeeEmail, date);
        }

        // ── Fall back to DB when Zimbra is unavailable ────────────────────────
        java.util.Set<String> dbBooked = (zimbraBusy == null)
                ? appointmentRepository.findBookedTimes(date, personToMeetId)
                : java.util.Set.of();

        log.debug("[Slots] date={} employee={} zimbra={} dbFallback={}",
                dateStr, employeeEmail,
                zimbraBusy != null ? "ok" : "unavailable",
                zimbraBusy == null);

        // Fixed daily schedule: 09:00–17:00, every 30 minutes
        List<AppointmentSlotDto> slots = new ArrayList<>();
        int[][] schedule = {
            {9, 0}, {9, 30}, {10, 0}, {10, 30}, {11, 0}, {11, 30},
            {12, 0}, {12, 30}, {13, 0}, {13, 30}, {14, 0}, {14, 30},
            {15, 0}, {15, 30}, {16, 0}, {16, 30}, {17, 0}
        };

        for (int[] hm : schedule) {
            String display = formatSlotDisplay(hm[0], hm[1]);
            boolean available;

            if (zimbraBusy != null) {
                // Zimbra available: slot is free only when Zimbra says free
                long slotStartMs = LocalDateTime.of(date, LocalTime.of(hm[0], hm[1]))
                        .atZone(java.time.ZoneId.of("Asia/Kolkata")).toInstant().toEpochMilli();
                long slotEndMs = slotStartMs + 30L * 60 * 1000;
                available = !isZimbraBusy(zimbraBusy, slotStartMs, slotEndMs);
            } else {
                // Zimbra unavailable: use DB to prevent double-booking
                available = !dbBooked.contains(display);
            }

            slots.add(AppointmentSlotDto.builder()
                    .value(String.format("%02d:%02d", hm[0], hm[1]))
                    .time(display)
                    .available(available)
                    .build());
        }
        return slots;
    }

    /** Returns true when [slotStart, slotEnd) overlaps any busy period from Zimbra. */
    private static boolean isZimbraBusy(List<long[]> busyPeriods, long slotStart, long slotEnd) {
        for (long[] period : busyPeriods) {
            if (slotStart < period[1] && slotEnd > period[0]) return true;
        }
        return false;
    }

    // ── Booking ───────────────────────────────────────────────────────────────

    /**
     * Validates and persists an appointment booking to the {@code appointmentslog} table.
     */
    @Transactional
    public AppointmentConfirmationDto bookAppointment(AppointmentBookingRequestDto req) {
        validateDate(req.getAppointmentDate());

        // NOTE: OTP gateway is not yet active; frontend mocks both visitor and employee
        // OTP verification locally.  The assertXxxBookingAuth calls are therefore
        // bypassed until the SMS gateway is wired up.
        // TODO: Restore the block below once the SMS gateway is live:
        // if ("EMPLOYEE".equalsIgnoreCase(req.getEntryType())) {
        //     otpService.assertEmployeeBookingAuth(req.getEmpId());
        // } else {
        //     otpService.assertVisitorBookingAuth(req.getMobile());
        // }

        PersonToMeetDto person = visitorRepository.findPersonById(req.getPersonToMeetId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Person to meet not found: " + req.getPersonToMeetId()));

        String locationName = locationRepository.findAllActive().stream()
                .filter(l -> l.getLocationId().equals(req.getLocationId()))
                .map(Location::getDescriptiveName)
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Invalid locationId: " + req.getLocationId()));

        // Guard: slot must still be available in the internal DB
        LocalDate date       = LocalDate.parse(req.getAppointmentDate(), DATE_FMT);
        LocalTime parsedTime = parseDisplayTime(req.getAppointmentTime());
        java.util.Set<String> booked = appointmentRepository.findBookedTimes(date, req.getPersonToMeetId());
        if (booked.contains(req.getAppointmentTime().toUpperCase().trim())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This time slot has just been booked. Please select another.");
        }

        // Resolve employee email for Zimbra (free/busy check + invite)
        String employeeEmail = userRepository.findUserMasterByEmployeeId(req.getPersonToMeetId())
                .map(m -> m.getWorkemail())
                .filter(e -> e != null && !e.isBlank())
                .orElse(null);

        // ── Zimbra free/busy check (pre-insert guard) ─────────────────────────
        // Hard-reject before writing to DB if the employee's Zimbra calendar is busy.
        // Silently skipped when employeeEmail is unknown or Zimbra is unreachable.
        LocalDateTime zimbraStart = LocalDateTime.of(date, parsedTime);
        LocalDateTime zimbraEnd   = zimbraStart.plusMinutes(30);
        if (employeeEmail != null) {
            zimbraAppointmentService.checkEmployeeAvailability(employeeEmail, zimbraStart, zimbraEnd);
        }

        // Resolve visitor name for EMPLOYEE bookings
        String resolvedName = req.getName();
        if ("EMPLOYEE".equalsIgnoreCase(req.getEntryType())) {
            PersonToMeetDto emp = visitorRepository.findPersonById(req.getEmpId()).orElse(null);
            if (emp != null) resolvedName = emp.getName();
        }

        // Employee flow does not send mobile in the JSON body; persist HR phone for front-desk list / check-in
        String mobileForLog = req.getMobile() != null ? req.getMobile().trim() : null;
        if ((mobileForLog == null || mobileForLog.isBlank()) && "EMPLOYEE".equalsIgnoreCase(req.getEntryType())) {
            String empId = req.getEmpId();
            if (empId != null && !empId.isBlank()) {
                UserMaster master = userRepository.findUserMasterByEmployeeId(empId.trim()).orElse(null);
                if (master != null && master.getPhone() != null && !master.getPhone().isBlank()) {
                    mobileForLog = master.getPhone().trim();
                }
            }
        }

        String token     = UUID.randomUUID().toString();
        String reference = buildReference(req.getAppointmentDate());

        AppointmentLog log = AppointmentLog.builder()
                .appointmentId  (reference)
                .bookingToken   (token)
                .entryType      (req.getEntryType() != null ? req.getEntryType().toUpperCase() : "VISITOR")
                .name           (resolvedName)
                .aadhaarNumber  (req.getAadhaarNumber())
                .email          (req.getEmail())
                .mobile         (mobileForLog)
                .empId          (req.getEmpId())
                .personToMeet   (person.getId())
                .personName     (person.getName())
                .department     (person.getDepartment())
                .locationId     (req.getLocationId())
                .locationName   (locationName)
                .appointmentDate(date)
                .appointmentTime(parsedTime)
                .reasonForVisit (req.getReasonForVisit())
                .build();

        appointmentRepository.insert(log);

        // ── Zimbra calendar event (post-insert, best-effort) ──────────────────
        // The DB record is already committed at this point.
        // If Zimbra creation fails, the booking remains in the DB and the
        // receptionist can still check the visitor in.  Log the failure for ops.
        String zimbraInviteId = null;
        if (employeeEmail != null) {
            try {
                zimbraInviteId = zimbraAppointmentService.createVisitorAppointment(
                        employeeEmail,
                        req.getEmail(),
                        resolvedName,
                        person.getDepartment(),
                        locationName,
                        req.getReasonForVisit(),
                        zimbraStart,
                        zimbraEnd);
            } catch (ResponseStatusException rse) {
                // 409 should never reach here (checked pre-insert), but guard anyway
                AppointmentService.log.warn(
                        "[Appointment] Zimbra event skipped for ref={} — {}", reference, rse.getReason());
            } catch (Exception ex) {
                AppointmentService.log.error(
                        "[Appointment] Zimbra event creation failed for ref={}: {}", reference, ex.getMessage());
            }
        }

        if ("EMPLOYEE".equalsIgnoreCase(req.getEntryType())) {
            otpService.consumeEmployeeBookingAuth(req.getEmpId());
        } else {
            otpService.consumeVisitorBookingAuth(req.getMobile());
        }

        AppointmentService.log.info("[Appointment] Booked {} {} → {} on {} at {} (ref={}, zimbraInviteId={})",
                log.getEntryType(), resolvedName,
                person.getName(), req.getAppointmentDate(), req.getAppointmentTime(), reference, zimbraInviteId);

        return AppointmentConfirmationDto.builder()
                .bookingToken    (token)
                .bookingReference(reference)
                .entryType       (log.getEntryType())
                .name            (resolvedName)
                .mobile          (mobileForLog)
                .empId           (req.getEmpId())
                .email           (req.getEmail())
                .personToMeet    (person.getName())
                .personToMeetId  (person.getId())
                .department      (person.getDepartment())
                .locationId      (req.getLocationId())
                .locationName    (locationName)
                .reasonForVisit  (req.getReasonForVisit())
                .appointmentDate (req.getAppointmentDate())
                .appointmentTime (req.getAppointmentTime())
                .status          ("PENDING")
                .createdAt       (LocalDateTime.now())
                .build();
    }

    // ── Confirmation retrieval ─────────────────────────────────────────────────

    /** Returns the booking confirmation for the given UUID token. */
    public AppointmentConfirmationDto getConfirmation(String token) {
        AppointmentLog a = appointmentRepository.findByToken(token)
                .orElseThrow(() -> new NoSuchElementException("Booking not found for token: " + token));
        return toConfirmationDto(a);
    }

    // ── Front-desk listing ────────────────────────────────────────────────────

    /**
     * Returns a paginated appointment list with DB-level filtering.
     *
     * @param defaultView when true, shows only today's appointments from current time onwards
     * @param page        0-based page index
     * @param size        records per page
     * @param search      optional full-text search term
     * @param from        explicit date-range start (yyyy-MM-dd); ignored when defaultView=true
     * @param to          explicit date-range end   (yyyy-MM-dd); ignored when defaultView=true
     * @param locationId  optional location restriction
     */
    public Map<String, Object> listAppointments(boolean defaultView,
                                                 int page, int size,
                                                 String search,
                                                 String from, String to,
                                                 String locationId) {

        LocalDate fromDate = parseOptionalDate(from);
        LocalDate toDate   = parseOptionalDate(to);

        List<AppointmentLog> rows = appointmentRepository.findPage(
                defaultView, fromDate, toDate, search, locationId, page, size);
        int total = appointmentRepository.count(
                defaultView, fromDate, toDate, search, locationId);

        int totalPages = (total == 0) ? 1 : (int) Math.ceil((double) total / size);

        Set<String> empIdsNeedingPhone = new LinkedHashSet<>();
        for (AppointmentLog r : rows) {
            if (!"EMPLOYEE".equalsIgnoreCase(r.getEntryType())) continue;
            if (r.getMobile() != null && !r.getMobile().isBlank()) continue;
            if (r.getEmpId() == null || r.getEmpId().isBlank()) continue;
            empIdsNeedingPhone.add(r.getEmpId().trim());
        }
        Map<String, String> phoneByEmpId = empIdsNeedingPhone.isEmpty()
                ? Map.of()
                : userRepository.findPhonesByEmployeeIds(empIdsNeedingPhone);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("content",       rows.stream().map(a -> toListItem(a, phoneByEmpId)).toList());
        result.put("totalElements", total);
        result.put("totalPages",    totalPages);
        result.put("page",          page);
        return result;
    }

    // ── Check-in preview ──────────────────────────────────────────────────────

    /**
     * Returns the appointment details and the next available card code for the
     * caller's location — WITHOUT assigning the card.
     * Used by the frontend confirmation modal to show the card that will be assigned.
     */
    public Map<String, Object> getCheckInPreview(String appointmentId, String callerEmpId) {
        AppointmentLog appt = findAppointmentOrThrow(appointmentId);

        Map<String, String> phoneByEmpId = Map.of();
        if ("EMPLOYEE".equalsIgnoreCase(appt.getEntryType())
                && (appt.getMobile() == null || appt.getMobile().isBlank())
                && appt.getEmpId() != null && !appt.getEmpId().isBlank()) {
            phoneByEmpId = userRepository.findPhonesByEmployeeIds(List.of(appt.getEmpId().trim()));
        }

        // Cards are only assigned to VISITOR entries, not EMPLOYEE
        String nextCard = null;
        if (!"EMPLOYEE".equalsIgnoreCase(appt.getEntryType())) {
            String locationId = getUserLocation(callerEmpId);
            nextCard = cardService.peekNextCard(locationId).orElse(null);
        }

        Map<String, Object> preview = new LinkedHashMap<>();
        preview.put("appointment", toListItem(appt, phoneByEmpId));
        preview.put("nextCardCode", nextCard);
        return preview;
    }

    // ── Atomic check-in ───────────────────────────────────────────────────────

    /**
     * Atomically checks in an appointment:
     * <ol>
     *   <li>Reads the appointment from {@code appointmentslog}</li>
     *   <li>Builds a {@link VisitorRequestDto} and calls {@link VisitorService#checkIn}</li>
     *   <li>Deletes the appointment from {@code appointmentslog}</li>
     * </ol>
     * The entire operation runs within a single database transaction.
     *
     * @param appointmentId human-readable reference, e.g. "APT-20260416-0001"
     * @param callerEmpId   employee ID of the receptionist performing the check-in
     * @return the created {@link VisitorResponseDto} (contains assigned card code)
     */
    @Transactional
    public VisitorResponseDto performCheckIn(String appointmentId, String callerEmpId) {
        AppointmentLog appt = findAppointmentOrThrow(appointmentId);

        String mobileForCheckIn = appt.getMobile() != null ? appt.getMobile().trim() : null;
        if ((mobileForCheckIn == null || mobileForCheckIn.isBlank())
                && "EMPLOYEE".equalsIgnoreCase(appt.getEntryType())
                && appt.getEmpId() != null && !appt.getEmpId().isBlank()) {
            mobileForCheckIn = userRepository.findUserMasterByEmployeeId(appt.getEmpId().trim())
                    .map(UserMaster::getPhone)
                    .map(String::trim)
                    .filter(s -> !s.isBlank())
                    .orElse(null);
        }

        VisitorRequestDto req = new VisitorRequestDto();
        req.setVisitType     ("INDIVIDUAL");
        req.setEntryType     (appt.getEntryType() != null ? appt.getEntryType() : "VISITOR");
        req.setName          (appt.getName() != null ? appt.getName() : "Unknown");
        req.setMobile        (mobileForCheckIn);
        req.setEmpId         (appt.getEmpId());
        req.setPersonToMeetId(appt.getPersonToMeet());
        req.setGovtIdType    (appt.getAadhaarNumber() != null ? "AADHAAR" : null);
        req.setGovtIdNumber  (appt.getAadhaarNumber());
        req.setReasonForVisit(appt.getReasonForVisit());

        VisitorResponseDto visitor = visitorService.checkIn(req, callerEmpId);

        appointmentRepository.delete(appointmentId);

        AppointmentService.log.info("[Appointment] CheckIn complete: {} → visitorId={} card={}",
                appointmentId, visitor.getId(), visitor.getCardCode());
        return visitor;
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private AppointmentLog findAppointmentOrThrow(String appointmentId) {
        return appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Appointment not found: " + appointmentId));
    }

    private String getUserLocation(String employeeId) {
        return userRepository.findByEmployeeId(employeeId)
                .map(UserManagement::getLocation)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                        "User not found: " + employeeId));
    }

    private void validateDate(String dateStr) {
        try {
            LocalDate.parse(dateStr, DATE_FMT);
        } catch (DateTimeParseException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid date format. Expected yyyy-MM-dd, got: " + dateStr);
        }
    }

    /** Generates the next unique appointmentId for the given date. */
    private String buildReference(String dateStr) {
        String compact = dateStr.replace("-", "");
        int next = appointmentRepository.maxSequenceForDate(compact) + 1;
        return String.format("APT-%s-%04d", compact, next);
    }

    private static LocalDate parseOptionalDate(String s) {
        if (s == null || s.isBlank()) return null;
        try { return LocalDate.parse(s, DATE_FMT); } catch (DateTimeParseException e) { return null; }
    }

    /**
     * Parses a 12-hour display time string (e.g. "04:00 PM") into a {@link LocalTime}.
     * Falls back to midnight on parse failure.
     */
    private static LocalTime parseDisplayTime(String timeStr) {
        if (timeStr == null || timeStr.isBlank()) return LocalTime.MIDNIGHT;
        try {
            String[] parts  = timeStr.trim().split("\\s+");
            String[] hm     = parts[0].split(":");
            int hour        = Integer.parseInt(hm[0]);
            int minute      = hm.length > 1 ? Integer.parseInt(hm[1]) : 0;
            String period   = parts.length > 1 ? parts[1].toUpperCase() : "AM";
            if ("PM".equals(period) && hour != 12) hour += 12;
            if ("AM".equals(period) && hour == 12) hour  = 0;
            return LocalTime.of(hour, minute);
        } catch (Exception e) {
            return LocalTime.MIDNIGHT;
        }
    }

    private static String formatSlotDisplay(int hour, int minute) {
        String period = hour < 12 ? "AM" : "PM";
        int h12 = hour % 12;
        if (h12 == 0) h12 = 12;
        return String.format("%02d:%02d %s", h12, minute, period);
    }

    private static String maskPhone(String phone) {
        if (phone == null || phone.length() < 4) return "****";
        return phone.substring(0, 2) + "****" + phone.substring(phone.length() - 2);
    }

    private static String last4(String value) {
        if (value == null || value.length() < 4) return "****";
        return value.substring(value.length() - 4);
    }

    /**
     * Converts a DB appointment row to the front-desk list DTO.
     * When {@code employeePhoneByEmpId} is supplied, fills {@code mobile} from HR for EMPLOYEE rows
     * that were stored without a phone (older bookings).
     */
    private AppointmentListItemDto toListItem(AppointmentLog a, Map<String, String> employeePhoneByEmpId) {
        String mobile = a.getMobile();
        if ((mobile == null || mobile.isBlank())
                && "EMPLOYEE".equalsIgnoreCase(a.getEntryType())
                && a.getEmpId() != null
                && employeePhoneByEmpId != null) {
            String fromHr = employeePhoneByEmpId.get(a.getEmpId().trim());
            if (fromHr != null && !fromHr.isBlank()) {
                mobile = fromHr;
            }
        }
        String isoDateTime = null;
        if (a.getAppointmentDate() != null && a.getAppointmentTime() != null) {
            isoDateTime = a.getAppointmentDate().toString()
                    + "T" + a.getAppointmentTime().toString();
        } else if (a.getAppointmentDate() != null) {
            isoDateTime = a.getAppointmentDate().toString() + "T00:00:00";
        }
        return AppointmentListItemDto.builder()
                .id          (a.getAppointmentId())
                .patientName (a.getName())
                .mobile      (mobile)
                .empId       (a.getEmpId())
                .email       (a.getEmail())
                .personToMeet(a.getPersonName())
                .department  (a.getDepartment())
                .appointmentDate(isoDateTime)
                .status      ("PENDING")
                .reason      (a.getReasonForVisit())
                .locationId  (a.getLocationId())
                .locationName(a.getLocationName())
                .entryType   (a.getEntryType())
                .build();
    }

    /** Converts a DB appointment row to the public confirmation DTO. */
    private static AppointmentConfirmationDto toConfirmationDto(AppointmentLog a) {
        String timeDisplay = a.getAppointmentTime() != null
                ? formatTimeDisplay(a.getAppointmentTime()) : null;
        return AppointmentConfirmationDto.builder()
                .bookingToken    (a.getBookingToken())
                .bookingReference(a.getAppointmentId())
                .entryType       (a.getEntryType())
                .name            (a.getName())
                .mobile          (a.getMobile())
                .empId           (a.getEmpId())
                .email           (a.getEmail())
                .personToMeet    (a.getPersonName())
                .personToMeetId  (a.getPersonToMeet())
                .department      (a.getDepartment())
                .locationId      (a.getLocationId())
                .locationName    (a.getLocationName())
                .reasonForVisit  (a.getReasonForVisit())
                .appointmentDate (a.getAppointmentDate() != null ? a.getAppointmentDate().toString() : null)
                .appointmentTime (timeDisplay)
                .status          ("PENDING")
                .createdAt       (a.getCreatedAt())
                .build();
    }

    private static String formatTimeDisplay(LocalTime t) {
        int hour   = t.getHour();
        int minute = t.getMinute();
        String period = hour < 12 ? "AM" : "PM";
        int h12 = hour % 12;
        if (h12 == 0) h12 = 12;
        return String.format("%02d:%02d %s", h12, minute, period);
    }
}
