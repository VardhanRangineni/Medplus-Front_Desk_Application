package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.dto.EmployeeLookupResponseDto;
import com.medplus.frontdesk_backend.dto.PagedResponseDto;
import com.medplus.frontdesk_backend.dto.PersonToMeetDto;
import com.medplus.frontdesk_backend.dto.StatusCountsDto;
import com.medplus.frontdesk_backend.dto.VisitorMemberDto;
import com.medplus.frontdesk_backend.dto.VisitorMemberRequestDto;
import com.medplus.frontdesk_backend.dto.VisitorRequestDto;
import com.medplus.frontdesk_backend.dto.VisitorResponseDto;
import com.medplus.frontdesk_backend.model.EntryType;
import com.medplus.frontdesk_backend.model.GovtIdType;
import com.medplus.frontdesk_backend.model.UserManagement;
import com.medplus.frontdesk_backend.model.VisitStatus;
import com.medplus.frontdesk_backend.model.VisitType;
import com.medplus.frontdesk_backend.model.Visitor;
import com.medplus.frontdesk_backend.model.VisitorMember;
import com.medplus.frontdesk_backend.repository.UserRepository;
import com.medplus.frontdesk_backend.repository.VisitorRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class VisitorService {

    private static final Logger log = LoggerFactory.getLogger(VisitorService.class);

    private final VisitorRepository visitorRepository;
    private final UserRepository    userRepository;
    private final CardService       cardService;

    public VisitorService(VisitorRepository visitorRepository, UserRepository userRepository, CardService cardService) {
        this.visitorRepository = visitorRepository;
        this.userRepository = userRepository;
        this.cardService = cardService;
    }

    // ── Create ────────────────────────────────────────────────────────────────

    /**
     * Creates a new check-in entry (visitor or employee).
     * The locationId is resolved from the authenticated user's assigned location.
     */
    @Transactional
    public VisitorResponseDto checkIn(VisitorRequestDto req, String createdBy) {

        VisitType visitType = parseVisitType(req.getVisitType());

        // Validate: GROUP visits must include at least one member
        if (visitType == VisitType.GROUP
                && (req.getMembers() == null || req.getMembers().isEmpty())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "GROUP visits must include at least one member.");
        }

        // Resolve person-to-meet details
        PersonToMeetDto person = visitorRepository.findPersonById(req.getPersonToMeetId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Person to meet not found: " + req.getPersonToMeetId()));

        // Resolve the caller's location
        String locationId = getUserLocation(createdBy);

        // Generate visitor ID
        int seq = visitorRepository.nextVisitorSequence(visitType);
        String visitorId = buildVisitorId(visitType, seq);

        EntryType entryType = parseEntryType(req.getEntryType());

        // Guard: block duplicate active check-ins for the same person at the same location
        visitorRepository.findActiveCheckin(
                req.getEntryType(),
                req.getEmpId() != null ? req.getEmpId().trim() : null,
                req.getName() != null  ? req.getName().trim()  : null,
                req.getMobile() != null ? req.getMobile().trim() : null,
                locationId
        ).ifPresent(existingId -> {
            String who = entryType == EntryType.EMPLOYEE
                    ? "Employee " + req.getEmpId()
                    : req.getName();
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    who + " is already checked in (entry " + existingId + "). " +
                    "Please check out the existing entry before checking in again.");
        });

        // Auto-assign a card from card master for VISITOR entries when no card is manually provided
        Integer manualCard = req.getCardNumber();
        String  autoCardCode = null;
        if (entryType == EntryType.VISITOR && manualCard == null) {
            autoCardCode = cardService.assignNextCard(locationId, visitorId).orElse(null);
        }

        Visitor visitor = Visitor.builder()
                .visitorId(visitorId)
                .visitType(visitType)
                .entryType(entryType)
                .name(req.getName().trim())
                .mobile(req.getMobile() != null ? req.getMobile().trim() : null)
                .empId(req.getEmpId() != null ? req.getEmpId().trim() : null)
                .status(VisitStatus.CHECKED_IN)
                .personToMeet(person.getId())
                .personName(person.getName())
                .department(person.getDepartment())
                .locationId(locationId)
                .cardNumber(manualCard)
                .cardCode(autoCardCode)
                .govtIdType(parseGovtIdType(req.getGovtIdType()))
                .govtIdNumber(req.getGovtIdNumber() != null ? req.getGovtIdNumber().trim() : null)
                .checkInTime(LocalDateTime.now())
                .reasonForVisit(req.getReasonForVisit())
                .createdBy(createdBy)
                .build();

        visitorRepository.insertVisitor(visitor);
        log.info("Check-in created: {} ({}) card={} by {}",
                 visitorId, req.getName(), autoCardCode != null ? autoCardCode : manualCard, createdBy);

        // Insert members for group visits — each member also gets an auto-assigned card
        if (visitType == VisitType.GROUP && req.getMembers() != null) {
            int memberSeq = visitorRepository.nextMemberSequence();
            for (VisitorMemberRequestDto m : req.getMembers()) {
                String memberId = String.format("MED-GM-%04d", memberSeq++);
                String memberAutoCard = null;
                if (m.getCardNumber() == null) {
                    memberAutoCard = cardService.assignNextCard(locationId, visitorId).orElse(null);
                }
                visitorRepository.insertMember(VisitorMember.builder()
                        .memberId(memberId)
                        .visitorId(visitorId)
                        .name(m.getName().trim())
                        .cardNumber(m.getCardNumber())
                        .cardCode(memberAutoCard)
                        .status(VisitStatus.CHECKED_IN)
                        .build());
                log.info("Member registered: {} for group visit {} card={}",
                         memberId, visitorId, memberAutoCard != null ? memberAutoCard : m.getCardNumber());
            }
        }

        return buildResponse(visitor);
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    /**
     * Returns a single entry by visitor ID.
     * Throws 404 if not found.
     */
    public VisitorResponseDto getEntryById(String visitorId) {
        return visitorRepository.findById(visitorId)
                .map(this::buildResponse)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Visitor entry not found: " + visitorId));
    }

    /**
     * Returns a paginated page of entries.
     *
     * Date is optional — when null ALL dates are included (cross-date view for the
     * Check-In/Check-Out table).
     *
     * Role rules:
     *  - RECEPTIONIST: always scoped to their own location; locationIdParam ignored.
     *  - PRIMARY_ADMIN / REGIONAL_ADMIN:
     *      - locationIdParam supplied → that location only
     *      - locationIdParam blank/null → all locations
     *
     * @param status    optional tab filter: "checked-in", "checked-out"; null = all
     * @param page      0-based page index
     * @param size      records per page (default 20)
     */
    public PagedResponseDto<VisitorResponseDto> getEntries(String callerEmployeeId,
                                                           LocalDate from,
                                                           LocalDate to,
                                                           String locationIdParam,
                                                           String department,
                                                           String status,
                                                           int page, int size,
                                                           Authentication auth) {
        String dept     = blankToNull(department);
        String dbStatus = labelToDbStatus(status);
        int    offset   = page * size;

        if (isAdmin(auth)) {
            String locId = blankToNull(locationIdParam);
            List<Visitor> rows  = visitorRepository.findPaged(locId, from, to, dept, dbStatus, offset, size);
            long          total = visitorRepository.countFiltered(locId, from, to, dept, dbStatus);
            return PagedResponseDto.of(rows.stream().map(this::buildResponse).toList(), page, size, total);
        }

        String locationId = getUserLocation(callerEmployeeId);
        List<Visitor> rows  = visitorRepository.findPaged(locationId, from, to, dept, dbStatus, offset, size);
        long          total = visitorRepository.countFiltered(locationId, from, to, dept, dbStatus);
        return PagedResponseDto.of(rows.stream().map(this::buildResponse).toList(), page, size, total);
    }

    /**
     * Full-text search over entries — paginated, same role/location rules as getEntries.
     * When query is blank, delegates to {@link #getEntries}.
     */
    public PagedResponseDto<VisitorResponseDto> searchEntries(String callerEmployeeId,
                                                              LocalDate from,
                                                              LocalDate to,
                                                              String query,
                                                              String locationIdParam,
                                                              String department,
                                                              String status,
                                                              int page, int size,
                                                              Authentication auth) {
        if (query == null || query.isBlank()) {
            return getEntries(callerEmployeeId, from, to, locationIdParam, department, status, page, size, auth);
        }

        String dept     = blankToNull(department);
        String dbStatus = labelToDbStatus(status);
        int    offset   = page * size;

        if (isAdmin(auth)) {
            String locId  = blankToNull(locationIdParam);
            List<Visitor> rows  = visitorRepository.searchPaged(locId, from, to, query, dept, dbStatus, offset, size);
            long          total = visitorRepository.countSearch(locId, from, to, query, dept, dbStatus);
            return PagedResponseDto.of(rows.stream().map(this::buildResponse).toList(), page, size, total);
        }

        String locationId = getUserLocation(callerEmployeeId);
        List<Visitor> rows  = visitorRepository.searchPaged(locationId, from, to, query, dept, dbStatus, offset, size);
        long          total = visitorRepository.countSearch(locationId, from, to, query, dept, dbStatus);
        return PagedResponseDto.of(rows.stream().map(this::buildResponse).toList(), page, size, total);
    }

    /**
     * Returns per-status counts scoped to the caller's location for the tab badges.
     * Admins with no location override see counts across all locations.
     */
    public StatusCountsDto getStatusCounts(String callerEmployeeId,
                                           String locationIdParam,
                                           Authentication auth) {
        if (isAdmin(auth)) {
            String locId = blankToNull(locationIdParam);
            return visitorRepository.findStatusCounts(locId);
        }
        String locationId = getUserLocation(callerEmployeeId);
        return visitorRepository.findStatusCounts(locationId);
    }

    /**
     * Returns the most recent 20 visitor/employee entries for the caller's location.
     * Admins with no location filter receive the latest 20 entries across all locations.
     * Used by the Dashboard "Recent Visitors" widget.
     */
    public List<VisitorResponseDto> getRecentEntries(String callerEmployeeId, Authentication auth) {
        if (isAdmin(auth)) {
            return visitorRepository.findRecentAll(20)
                    .stream().map(this::buildResponse).toList();
        }
        String locationId = getUserLocation(callerEmployeeId);
        return visitorRepository.findRecent(locationId, 20)
                .stream().map(this::buildResponse).toList();
    }

    /**
     * Returns distinct department names found in the visitor log.
     *
     * When {@code date} is {@code null} departments across ALL dates are returned.
     * Used to build the dynamic "Filter by Dept" dropdown on the home page.
     */
    public List<String> getDepartmentsInLog(String callerEmployeeId, LocalDate date,
                                            String locationIdParam, Authentication auth) {
        if (isAdmin(auth)) {
            String locId = (locationIdParam != null && !locationIdParam.isBlank()) ? locationIdParam : null;
            return visitorRepository.findDistinctDepartmentsInLog(locId, date);
        }
        String locationId = getUserLocation(callerEmployeeId);
        return visitorRepository.findDistinctDepartmentsInLog(locationId, date);
    }

    /**
     * Exports visitor entries for a given date as a UTF-8 CSV.
     * Date defaults to today when null so the export remains focused.
     * Applies the same admin/location/department rules as getEntries.
     */
    public byte[] exportCsv(String callerEmployeeId, LocalDate date,
                            String locationIdParam, String department, Authentication auth) {
        LocalDate exportDate = date != null ? date : LocalDate.now();
        String    dept       = (department != null && !department.isBlank()) ? department : null;

        // Fetch all matching rows (no pagination) for the export
        List<Visitor> rows;
        if (isAdmin(auth)) {
            String locId = blankToNull(locationIdParam);
            rows = visitorRepository.findPaged(locId, exportDate, exportDate, dept, null, 0, Integer.MAX_VALUE);
        } else {
            String locationId = getUserLocation(callerEmployeeId);
            rows = visitorRepository.findPaged(locationId, exportDate, exportDate, dept, null, 0, Integer.MAX_VALUE);
        }

        List<VisitorResponseDto> entries = rows.stream().map(this::buildResponse).toList();
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm");

        StringBuilder sb = new StringBuilder();
        sb.append("ID,Type,Visit Type,Name,Mobile,Emp ID,Status,Person To Meet,Department,")
          .append("Location,Card,Govt ID Type,Govt ID Number,Check-In,Check-Out,Reason\n");

        for (VisitorResponseDto e : entries) {
            sb.append(csv(e.getId())).append(',')
              .append(csv(e.getType())).append(',')
              .append(csv(e.getVisitType())).append(',')
              .append(csv(e.getName())).append(',')
              .append(csv(e.getMobile())).append(',')
              .append(csv(e.getEmpId())).append(',')
              .append(csv(e.getStatus())).append(',')
              .append(csv(e.getPersonToMeet())).append(',')
              .append(csv(e.getDepartment())).append(',')
              .append(csv(e.getLocationName() != null ? e.getLocationName() : e.getLocationId())).append(',')
              .append(e.getCard() != null ? e.getCard() : "").append(',')
              .append(csv(e.getGovtIdType())).append(',')
              .append(csv(e.getGovtIdNumber())).append(',')
              .append(e.getCheckIn()  != null ? e.getCheckIn().format(fmt)  : "").append(',')
              .append(e.getCheckOut() != null ? e.getCheckOut().format(fmt) : "").append(',')
              .append(csv(e.getReasonForVisit())).append('\n');
        }
        return sb.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }

    private static String csv(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }

    // ── Update ────────────────────────────────────────────────────────────────

    /**
     * Updates visitor details (name, mobile/empId, personToMeet, card, reason).
     * Does not change status — use checkout endpoints for that.
     */
    @Transactional
    public VisitorResponseDto updateEntry(String visitorId, VisitorRequestDto req, String callerEmployeeId) {
        Visitor existing = visitorRepository.findById(visitorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Visitor entry not found: " + visitorId));

        PersonToMeetDto person = visitorRepository.findPersonById(req.getPersonToMeetId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Person to meet not found: " + req.getPersonToMeetId()));

        existing.setName(req.getName().trim());
        existing.setMobile(req.getMobile() != null ? req.getMobile().trim() : null);
        existing.setEmpId(req.getEmpId() != null ? req.getEmpId().trim() : null);
        existing.setPersonToMeet(person.getId());
        existing.setPersonName(person.getName());
        existing.setDepartment(person.getDepartment());
        existing.setCardNumber(req.getCardNumber());
        existing.setGovtIdType(parseGovtIdType(req.getGovtIdType()));
        existing.setGovtIdNumber(req.getGovtIdNumber() != null ? req.getGovtIdNumber().trim() : null);
        existing.setReasonForVisit(req.getReasonForVisit());
        existing.setCreatedBy(callerEmployeeId);

        visitorRepository.updateVisitor(existing);
        log.info("Entry updated: {} by {}", visitorId, callerEmployeeId);

        return buildResponse(existing);
    }

    // ── Check-out ─────────────────────────────────────────────────────────────

    /**
     * Checks out a main visitor/employee entry.
     *
     * @param cardReturned true = visitor returned their card (mark AVAILABLE);
     *                     false = card not returned (mark MISSING).
     *                     Ignored for EMPLOYEE entries (no card assigned).
     */
    @Transactional
    public VisitorResponseDto checkOut(String visitorId, boolean cardReturned, String callerEmployeeId) {
        Visitor existing = visitorRepository.findById(visitorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Visitor entry not found: " + visitorId));

        if (existing.getStatus() == VisitStatus.CHECKED_OUT) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Entry is already checked out: " + visitorId);
        }

        // Release card from card master when applicable
        if (existing.getEntryType() == EntryType.VISITOR && existing.getCardCode() != null) {
            cardService.releaseCard(existing.getCardCode(), cardReturned);
        }

        LocalDateTime now = LocalDateTime.now();
        visitorRepository.checkOutVisitor(visitorId, now, callerEmployeeId);

        existing.setStatus(VisitStatus.CHECKED_OUT);
        existing.setCheckOutTime(now);

        log.info("Checked out: {} (cardReturned={}) by {}", visitorId, cardReturned, callerEmployeeId);
        return buildResponse(existing);
    }

    /** Checks out a single member within a group visit. */
    @Transactional
    public VisitorMemberDto checkOutMember(String visitorId, String memberId,
                                           boolean cardReturned, String callerEmployeeId) {
        visitorRepository.findById(visitorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Visitor entry not found: " + visitorId));

        VisitorMember member = visitorRepository.findMemberById(memberId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Member not found: " + memberId));

        if (!member.getVisitorId().equals(visitorId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Member does not belong to this visitor entry.");
        }
        if (member.getStatus() == VisitStatus.CHECKED_OUT) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Member is already checked out: " + memberId);
        }

        // Release member card
        if (member.getCardCode() != null) {
            cardService.releaseCard(member.getCardCode(), cardReturned);
        }

        LocalDateTime now = LocalDateTime.now();
        visitorRepository.checkOutMember(memberId, now);

        log.info("Member checked out: {} (group: {}) cardReturned={} by {}",
                 memberId, visitorId, cardReturned, callerEmployeeId);

        return VisitorMemberDto.builder()
                .id(memberId)
                .name(member.getName())
                .card(member.getCardNumber())
                .cardCode(member.getCardCode())
                .status(VisitStatus.CHECKED_OUT.toLabel())
                .build();
    }

    // ── Person-to-meet search ─────────────────────────────────────────────────

    /**
     * Returns ALL employees at the caller's location (no filter).
     * Used to populate the "Person to Meet" dropdown on modal open.
     */
    public List<PersonToMeetDto> getPersonsAtLocation(String callerEmployeeId) {
        String locationId = getUserLocation(callerEmployeeId);
        return visitorRepository.findAllPersonsAtLocation(locationId);
    }

    /**
     * Searches employees at the caller's location by name, employee ID, or phone.
     * Returns all if query is blank (same as getPersonsAtLocation).
     */
    public List<PersonToMeetDto> searchPersonsToMeet(String callerEmployeeId, String query) {
        String locationId = getUserLocation(callerEmployeeId);
        if (query == null || query.isBlank()) {
            return visitorRepository.findAllPersonsAtLocation(locationId);
        }
        return visitorRepository.searchPersonsToMeet(locationId, query);
    }

    /**
     * Returns distinct department names at the caller's location.
     * Used to populate the "Host Department" dropdown.
     */
    public List<String> getDepartmentsAtLocation(String callerEmployeeId) {
        String locationId = getUserLocation(callerEmployeeId);
        return visitorRepository.findDistinctDepartmentsAtLocation(locationId);
    }

    /**
     * Looks up an employee by ID and returns their name, department, and masked phone.
     * Used by the employee check-in flow (Step 1 — Employee ID lookup).
     */
    public EmployeeLookupResponseDto lookupEmployee(String empId) {
        return visitorRepository.findPersonById(empId)
                .map(p -> EmployeeLookupResponseDto.builder()
                        .found(true)
                        .employee(EmployeeLookupResponseDto.EmployeeInfo.builder()
                                .id(p.getId())
                                .name(p.getName())
                                .department(p.getDepartment())
                                .maskedPhone(maskPhone(p.getPhone()))
                                .build())
                        .build())
                .orElse(EmployeeLookupResponseDto.builder()
                        .found(false)
                        .message("Employee ID not found. Please check and try again.")
                        .build());
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private static String blankToNull(String value) {
        return (value != null && !value.isBlank()) ? value : null;
    }

    /**
     * Converts the UI label sent by the frontend to the DB enum name.
     * "checked-in"  → "CHECKED_IN"
     * "checked-out" → "CHECKED_OUT"
     * null / other  → null (no filter)
     */
    private static String labelToDbStatus(String label) {
        if (label == null) return null;
        return switch (label.toLowerCase()) {
            case "checked-in"  -> "CHECKED_IN";
            case "checked-out" -> "CHECKED_OUT";
            default            -> null;
        };
    }

    private static String maskPhone(String phone) {
        if (phone == null || phone.length() < 4) return "****";
        return phone.substring(0, 2) + "****" + phone.substring(phone.length() - 2);
    }

    private String getUserLocation(String employeeId) {
        return userRepository.findByEmployeeId(employeeId)
                .map(UserManagement::getLocation)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                        "User not found in management records: " + employeeId));
    }

    /**
     * Returns true if the authenticated user has the PRIMARY_ADMIN or REGIONAL_ADMIN role.
     * These roles may override the location filter and access cross-location data.
     */
    private boolean isAdmin(Authentication auth) {
        if (auth == null) return false;
        return auth.getAuthorities().stream().anyMatch(a ->
                "ROLE_PRIMARY_ADMIN".equals(a.getAuthority()) ||
                "ROLE_REGIONAL_ADMIN".equals(a.getAuthority()));
    }

    private static VisitType parseVisitType(String raw) {
        try {
            return VisitType.valueOf(raw.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid visitType '" + raw + "'. Must be INDIVIDUAL or GROUP.");
        }
    }

    private static EntryType parseEntryType(String raw) {
        try {
            return EntryType.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid entryType '" + raw + "'. Must be VISITOR or EMPLOYEE.");
        }
    }

    private static GovtIdType parseGovtIdType(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return GovtIdType.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid govtIdType '" + raw + "'. Must be one of: AADHAAR, PAN, PASSPORT, VOTER, DL.");
        }
    }

    private static String buildVisitorId(VisitType visitType, int seq) {
        String prefix = visitType == VisitType.GROUP ? "MED-GV" : "MED-V";
        return String.format("%s-%04d", prefix, seq);
    }

    /** Builds a full VisitorResponseDto (with members list loaded from DB). */
    private VisitorResponseDto buildResponse(Visitor v) {
        List<VisitorMemberDto> members = visitorRepository
                .findMembersByVisitorId(v.getVisitorId())
                .stream()
                .map(m -> VisitorMemberDto.builder()
                        .id(m.getMemberId())
                        .name(m.getName())
                        .card(m.getCardNumber())
                        .cardCode(m.getCardCode())
                        .status(m.getStatus().toLabel())
                        .build())
                .toList();

        String locationName = visitorRepository.findLocationName(v.getLocationId()).orElse(null);

        // For GROUP visits, expose cardNumber also as leadCardNumber so edit forms pre-fill correctly
        Integer leadCard = (v.getVisitType() == VisitType.GROUP) ? v.getCardNumber() : null;

        return VisitorResponseDto.builder()
                .id(v.getVisitorId())
                .type(v.getEntryType().name())
                .visitType(v.getVisitType().name())
                .name(v.getName())
                .mobile(v.getMobile())
                .empId(v.getEmpId())
                .status(v.getStatus().toLabel())
                .personToMeet(v.getPersonName())
                .personToMeetId(v.getPersonToMeet())
                .department(v.getDepartment())
                .hostDepartment(v.getDepartment())
                .locationId(v.getLocationId())
                .locationName(locationName)
                .card(v.getCardNumber())
                .leadCardNumber(leadCard)
                .cardCode(v.getCardCode())
                .govtIdType(v.getGovtIdType() != null ? v.getGovtIdType().name() : null)
                .govtIdNumber(v.getGovtIdNumber())
                .checkIn(v.getCheckInTime())
                .checkOut(v.getCheckOutTime())
                .reasonForVisit(v.getReasonForVisit())
                .members(members)
                .build();
    }
}
