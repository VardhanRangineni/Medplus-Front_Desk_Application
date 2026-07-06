package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.dto.DeviceMasterDto;
import com.medplus.frontdesk_backend.dto.EmployeeLookupResponseDto;
import com.medplus.frontdesk_backend.dto.PagedResponseDto;
import com.medplus.frontdesk_backend.dto.PersonToMeetDto;
import com.medplus.frontdesk_backend.dto.StatusCountsDto;
import com.medplus.frontdesk_backend.dto.UserLookupDto;
import com.medplus.frontdesk_backend.dto.VisitorMovementEventDto;
import com.medplus.frontdesk_backend.dto.VisitorRequestDto;
import com.medplus.frontdesk_backend.dto.VisitorResponseDto;
import com.medplus.frontdesk_backend.model.EntryType;
import com.medplus.frontdesk_backend.model.GovtIdType;
import com.medplus.frontdesk_backend.model.UserManagement;
import com.medplus.frontdesk_backend.model.UserRole;
import com.medplus.frontdesk_backend.model.VisitStatus;
import com.medplus.frontdesk_backend.model.VisitType;
import com.medplus.frontdesk_backend.model.Visitor;
import com.medplus.frontdesk_backend.repository.DeviceMasterRepository;
import com.medplus.frontdesk_backend.repository.UserRepository;
import com.medplus.frontdesk_backend.repository.VisitorRepository;
import com.medplus.frontdesk_backend.security.AuthorizationHelper;
import com.medplus.frontdesk_backend.util.WorkstationMacUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
public class VisitorService {

    private static final Logger log = LoggerFactory.getLogger(VisitorService.class);

    private final VisitorRepository visitorRepository;
    private final UserRepository    userRepository;
    private final HrmsService       hrmsService;
    private final VisitPassService  visitPassService;
    private final OperationalLocationService operationalLocationService;
    private final LocationScopeService locationScopeService;
    private final VisitorScanService visitorScanService;
    private final DeviceMasterRepository deviceMasterRepository;
    private final AuthorizationHelper authorizationHelper;

    public VisitorService(VisitorRepository visitorRepository, UserRepository userRepository,
                          HrmsService hrmsService, VisitPassService visitPassService,
                          OperationalLocationService operationalLocationService,
                          LocationScopeService locationScopeService,
                          VisitorScanService visitorScanService,
                          DeviceMasterRepository deviceMasterRepository,
                          AuthorizationHelper authorizationHelper) {
        this.visitorRepository = visitorRepository;
        this.userRepository = userRepository;
        this.hrmsService = hrmsService;
        this.visitPassService = visitPassService;
        this.operationalLocationService = operationalLocationService;
        this.locationScopeService = locationScopeService;
        this.visitorScanService = visitorScanService;
        this.deviceMasterRepository = deviceMasterRepository;
        this.authorizationHelper = authorizationHelper;
    }

    // ── Create ────────────────────────────────────────────────────────────────

    /**
     * Creates a new check-in entry (visitor or employee).
     * The locationId is resolved from the authenticated user's assigned location.
     */
    @Transactional
    public VisitorResponseDto checkIn(VisitorRequestDto req, String createdBy, String workstationMac) {
        return checkIn(req, createdBy, workstationMac, null);
    }

    /**
     * @param existingPreregToken when set (QR check-in from website self-registration),
     *                            skip desk visit-pass SMS — visitor already has the QR.
     */
    @Transactional
    public VisitorResponseDto checkIn(VisitorRequestDto req, String createdBy, String workstationMac,
                                      String existingPreregToken) {

        authorizationHelper.requireCheckInPermission();

        validateVisitRequest(req);

        EntryType entryType = parseEntryType(req.getEntryType());
        PersonToMeetDto person = resolvePersonToMeet(req.getPersonToMeetId());

        String entryDepartment = entryType == EntryType.EMPLOYEE
                && req.getEmployeeDepartment() != null && !req.getEmployeeDepartment().isBlank()
                ? req.getEmployeeDepartment().trim()
                : person.getDepartment();

        // Prefer operator's assigned kiosk (desk identity), not only PC MAC.
        var deviceOpt = operationalLocationService.resolveDeskDevice(createdBy, workstationMac);
        String locationId = deviceOpt
                .map(com.medplus.frontdesk_backend.dto.DeviceMasterDto::getLocationId)
                .filter(id -> id != null && !id.isBlank())
                .orElseGet(() -> operationalLocationService.resolveForUser(createdBy, workstationMac));
        String checkInDeviceId = deviceOpt.map(com.medplus.frontdesk_backend.dto.DeviceMasterDto::getDeviceId)
                .orElse(null);

        // Generate visitor ID — always INDIVIDUAL now
        int seq = visitorRepository.nextVisitorSequence(VisitType.INDIVIDUAL);
        String visitorId = String.format("MED-V-%04d", seq);

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

        Visitor visitor = Visitor.builder()
                .visitorId(visitorId)
                .visitType(VisitType.INDIVIDUAL)
                .entryType(entryType)
                .name(req.getName().trim())
                .mobile(req.getMobile() != null ? req.getMobile().trim() : null)
                .empId(req.getEmpId() != null ? req.getEmpId().trim() : null)
                .status(VisitStatus.CHECKED_IN)
                .personToMeet(person.getId())
                .personName(person.getName())
                .department(entryDepartment)
                .locationId(locationId)
                .cardNumber(req.getCardNumber())
                .govtIdType(parseGovtIdType(req.getGovtIdType()))
                .govtIdNumber(req.getGovtIdNumber() != null ? req.getGovtIdNumber().trim() : null)
                .checkInTime(LocalDateTime.now())
                .reasonForVisit(req.getReasonForVisit())
                .companyName(req.getCompanyName() != null && !req.getCompanyName().isBlank()
                        ? req.getCompanyName().trim() : null)
                .createdBy(createdBy)
                .workstationMac(WorkstationMacUtil.toStoredValue(workstationMac))
                .checkInDeviceId(checkInDeviceId)
                .lastScanDeviceId(checkInDeviceId)
                .lastScanAt(checkInDeviceId != null ? LocalDateTime.now() : null)
                .build();

        visitorRepository.insertVisitor(visitor);
        String preregTokenForScan = hasText(existingPreregToken) ? existingPreregToken.trim() : null;
        deviceOpt.ifPresent(device -> visitorScanService.recordCheckInScan(
                visitor, device, createdBy, workstationMac, preregTokenForScan));
        log.info("Check-in created: {} ({}) card={} by {}",
                 visitorId, req.getName(), req.getCardNumber(), createdBy);

        VisitorResponseDto response = toResponses(List.of(visitor)).get(0);

        if (preregTokenForScan != null) {
            response.setVisitPassToken(preregTokenForScan);
            response.setVisitPassSmsStatus("SKIPPED");
            response.setVisitPassMessage("Visitor already has a registration QR — no SMS sent.");
        } else if (visitPassService.isEligible(visitor)) {
            String passToken = visitPassService.initiateDeskWalkInPass(visitor);
            response.setVisitPassToken(passToken);
            response.setVisitPassSmsStatus("PENDING");
            response.setVisitPassMessage("Visit pass is being sent to the visitor's mobile.");
        } else {
            response.setVisitPassSmsStatus("SKIPPED");
        }

        return response;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    public boolean resendVisitPass(String visitorId) {
        return visitPassService.resendForVisitor(visitorId);
    }

    /**
     * Returns a single entry by visitor ID.
     * Throws 404 if not found.
     */
    public VisitorResponseDto getEntryById(String visitorId) {
        Visitor visitor = visitorRepository.findById(visitorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Visitor entry not found: " + visitorId));
        VisitorResponseDto dto = toResponses(List.of(visitor)).get(0);
        visitPassService.findPassTokenForVisitor(visitorId).ifPresent(dto::setVisitPassToken);
        return dto;
    }

    public List<VisitorMovementEventDto> getMovementTrail(String visitorId) {
        if (!visitorRepository.findById(visitorId).isPresent()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Visitor entry not found: " + visitorId);
        }
        return visitorScanService.getMovementTrail(visitorId);
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
     *      - locationIdParam / allLocations → admin overrides
     *      - otherwise → operational location from current kiosk
     *
     * @param status    optional tab filter: "checked-in", "checked-out"; null = all
     * @param page      0-based page index
     * @param size      records per page (default 20)
     */
    public PagedResponseDto<VisitorResponseDto> getEntries(String callerEmployeeId,
                                                           LocalDate from,
                                                           LocalDate to,
                                                           String locationIdParam,
                                                           Boolean allLocations,
                                                           String department,
                                                           String status,
                                                           String createdByParam,
                                                           int page, int size,
                                                           String workstationMac,
                                                           Authentication auth) {
        String dept       = blankToNull(department);
        String dbStatus   = labelToDbStatus(status);
        String createdBy  = resolveCreatedByFilter(callerEmployeeId, createdByParam, auth);
        int    offset     = page * size;

        String locationId = locationScopeService.resolveReadScope(
                callerEmployeeId, workstationMac, auth, locationIdParam, allLocations);
        List<Visitor> rows  = visitorRepository.findPaged(
                locationId, from, to, dept, dbStatus, createdBy, offset, size);
        long total = visitorRepository.countFiltered(locationId, from, to, dept, dbStatus, createdBy);
        return PagedResponseDto.of(toResponses(rows), page, size, total);
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
                                                              Boolean allLocations,
                                                              String department,
                                                              String status,
                                                              String createdByParam,
                                                              int page, int size,
                                                              String workstationMac,
                                                              Authentication auth) {
        if (query == null || query.isBlank()) {
            return getEntries(callerEmployeeId, from, to, locationIdParam, allLocations, department, status,
                    createdByParam, page, size, workstationMac, auth);
        }

        String dept      = blankToNull(department);
        String dbStatus  = labelToDbStatus(status);
        String createdBy = resolveCreatedByFilter(callerEmployeeId, createdByParam, auth);
        int    offset    = page * size;

        String locationId = locationScopeService.resolveReadScope(
                callerEmployeeId, workstationMac, auth, locationIdParam, allLocations);
        List<Visitor> rows = visitorRepository.searchPaged(
                locationId, from, to, query, dept, dbStatus, createdBy, offset, size);
        long total = visitorRepository.countSearch(locationId, from, to, query, dept, dbStatus, createdBy);
        return PagedResponseDto.of(toResponses(rows), page, size, total);
    }

    /**
     * Returns per-status counts scoped to the caller's location for the tab badges.
     * Admins with no location override see counts across all locations.
     */
    public StatusCountsDto getStatusCounts(String callerEmployeeId,
                                           String locationIdParam,
                                           Boolean allLocations,
                                           String workstationMac,
                                           Authentication auth) {
        String locationId = locationScopeService.resolveReadScope(
                callerEmployeeId, workstationMac, auth, locationIdParam, allLocations);
        return visitorRepository.findStatusCounts(locationId);
    }

    /**
     * Returns the most recent 20 visitor/employee entries for the caller's location.
     * Admins with no location filter receive the latest 20 entries across all locations.
     * Used by the Dashboard "Recent Visitors" widget.
     */
    public List<VisitorResponseDto> getRecentEntries(String callerEmployeeId,
                                                     String workstationMac,
                                                     String locationIdParam,
                                                     Boolean allLocations,
                                                     Authentication auth) {
        String locationId = locationScopeService.resolveReadScope(
                callerEmployeeId, workstationMac, auth, locationIdParam, allLocations);
        if (locationId == null) {
            return toResponses(visitorRepository.findRecentAll(20));
        }
        return toResponses(visitorRepository.findRecent(locationId, 20));
    }

    /**
     * Returns distinct department names found in the visitor log.
     *
     * When {@code date} is {@code null} departments across ALL dates are returned.
     * Used to build the dynamic "Filter by Dept" dropdown on the home page.
     */
    public List<String> getDepartmentsInLog(String callerEmployeeId, LocalDate date,
                                            String locationIdParam, Boolean allLocations,
                                            String workstationMac,
                                            Authentication auth) {
        String locationId = locationScopeService.resolveReadScope(
                callerEmployeeId, workstationMac, auth, locationIdParam, allLocations);
        return visitorRepository.findDistinctDepartmentsInLog(locationId, date);
    }

    /**
     * Exports visitor entries for a given date as a UTF-8 CSV.
     * Date defaults to today when null so the export remains focused.
     * Applies the same admin/location/department rules as getEntries.
     */
    public byte[] exportCsv(String callerEmployeeId, LocalDate date,
                            String locationIdParam, Boolean allLocations, String department,
                            String workstationMac, Authentication auth) {
        LocalDate exportDate = date != null ? date : LocalDate.now();
        String    dept       = (department != null && !department.isBlank()) ? department : null;

        String locationId = locationScopeService.resolveReadScope(
                callerEmployeeId, workstationMac, auth, locationIdParam, allLocations);
        List<Visitor> rows = visitorRepository.findPaged(
                locationId, exportDate, exportDate, dept, null, null, 0, Integer.MAX_VALUE);

        List<VisitorResponseDto> entries = toResponses(rows);
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
    public VisitorResponseDto updateEntry(String visitorId, VisitorRequestDto req,
                                          String callerEmployeeId, String workstationMac,
                                          Authentication auth) {
        Visitor existing = visitorRepository.findById(visitorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Visitor entry not found: " + visitorId));
        assertCanMutateEntry(existing, callerEmployeeId, workstationMac, auth);

        validateVisitRequest(req);

        PersonToMeetDto person = resolvePersonToMeet(req.getPersonToMeetId());

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
        existing.setCompanyName(req.getCompanyName() != null && !req.getCompanyName().isBlank()
                ? req.getCompanyName().trim() : null);
        existing.setCreatedBy(callerEmployeeId);

        visitorRepository.updateVisitor(existing);
        log.info("Entry updated: {} by {}", visitorId, callerEmployeeId);

        return toResponses(List.of(existing)).get(0);
    }

    // ── Check-out ─────────────────────────────────────────────────────────────

    /**
     * Checks out a main visitor/employee entry.
     *
     */
    @Transactional
    public VisitorResponseDto checkOut(String visitorId,
                                       String callerEmployeeId, String workstationMac,
                                       Authentication auth) {
        Visitor existing = visitorRepository.findById(visitorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Visitor entry not found: " + visitorId));
        assertCanMutateEntry(existing, callerEmployeeId, workstationMac, auth);

        if (existing.getStatus() == VisitStatus.CHECKED_OUT) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Entry is already checked out: " + visitorId);
        }

        LocalDateTime now = LocalDateTime.now();
        visitorRepository.checkOutVisitor(visitorId, now, callerEmployeeId);

        operationalLocationService.resolveDeskDevice(callerEmployeeId, workstationMac)
                .ifPresent(device -> {
                    visitorScanService.recordCheckOutScan(
                            existing, device, callerEmployeeId, workstationMac);
                    existing.setLastScanDeviceId(device.getDeviceId());
                    existing.setLastScanAt(now);
                });

        existing.setStatus(VisitStatus.CHECKED_OUT);
        existing.setCheckOutTime(now);

        log.info("Checked out: {} by {}", visitorId, callerEmployeeId);
        return toResponses(List.of(existing)).get(0);
    }

    // ── Person-to-meet search ─────────────────────────────────────────────────

    /**
     * Returns ALL employees at the caller's location (no filter).
     * Used to populate the "Person to Meet" dropdown on modal open.
     */
    public List<PersonToMeetDto> getPersonsAtLocation(String callerEmployeeId, String workstationMac) {
        String locationId = operationalLocationService.resolveForUser(callerEmployeeId, workstationMac);
        return visitorRepository.findAllPersonsAtLocation(locationId);
    }

    /**
     * Looks up a person-to-meet by mobile via HRMS (no location filter).
     */
    public PersonToMeetDto lookupPersonToMeetByMobile(String mobile, String callerEmployeeId) {
        UserLookupDto hrms = hrmsService.lookupByPhoneNo(mobile)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "No employee found in HRMS for this mobile number."));

        if (hrms.getId() == null || hrms.getId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "HRMS response is missing an employee ID.");
        }
        if (hrms.getName() == null || hrms.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "HRMS response is missing an employee name.");
        }

        return toPersonToMeet(hrms);
    }

    /** Resolves person-to-meet from local user master, or HRMS when not registered locally. */
    private PersonToMeetDto resolvePersonToMeet(String personToMeetId) {
        return visitorRepository.findPersonById(personToMeetId)
                .or(() -> lookupPersonFromHrms(personToMeetId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Person to meet not found: " + personToMeetId));
    }

    private Optional<PersonToMeetDto> lookupPersonFromHrms(String idOrHrmsId) {
        Optional<UserLookupDto> hrms = hrmsService.lookupByEmployeeId(idOrHrmsId);
        if (hrms.isEmpty()) {
            hrms = hrmsService.lookupByHrmsId(idOrHrmsId);
        }
        return hrms.map(this::toPersonToMeet);
    }

    private PersonToMeetDto toPersonToMeet(UserLookupDto e) {
        return PersonToMeetDto.builder()
                .id(e.getId())
                .name(e.getName())
                .phone(e.getPhone())
                .department(e.getDepartment() != null ? e.getDepartment() : "")
                .designation(e.getDesignation())
                .build();
    }

    /**
     * Searches employees at the caller's location by name, employee ID, or phone.
     * Returns all if query is blank (same as getPersonsAtLocation).
     */
    public List<PersonToMeetDto> searchPersonsToMeet(String callerEmployeeId, String query,
                                                     String workstationMac) {
        String locationId = operationalLocationService.resolveForUser(callerEmployeeId, workstationMac);
        if (query == null || query.isBlank()) {
            return visitorRepository.findAllPersonsAtLocation(locationId);
        }
        return visitorRepository.searchPersonsToMeet(locationId, query);
    }

    /**
     * Returns distinct department names at the caller's location.
     * Used to populate the "Host Department" dropdown.
     */
    public List<String> getDepartmentsAtLocation(String callerEmployeeId, String workstationMac) {
        String locationId = operationalLocationService.resolveForUser(callerEmployeeId, workstationMac);
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
     * Resolves createdBy filter for list/search:
     * - Receptionist may only filter to their own employee ID.
     * - Admins may filter to any staff ID (or omit for all).
     */
    private String resolveCreatedByFilter(String callerEmployeeId, String createdByParam,
                                          Authentication auth) {
        String requested = blankToNull(createdByParam);
        if (requested == null) {
            return null;
        }
        if (isAdmin(auth)) {
            return requested;
        }
        if (!requested.equalsIgnoreCase(callerEmployeeId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "You can only view your own entries.");
        }
        return requested;
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

    /**
     * Mutation access rules for visitor entries:
     * - PRIMARY_ADMIN: can mutate any entry.
     * - REGIONAL_ADMIN: can mutate own entries OR entries created by receptionists they created.
     * - RECEPTIONIST: entries they created, or entries checked in on this workstation (shift handoff).
     */
    private void assertCanMutateEntry(Visitor existing, String callerEmployeeId,
                                      String callerWorkstationMac, Authentication auth) {
        if (auth == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied.");
        }
        String entryCreator = existing.getCreatedBy();
        if (entryCreator == null || entryCreator.isBlank()) {
            if (hasRole(auth, "ROLE_PRIMARY_ADMIN")) return;
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Action blocked. Entry has no creator mapping.");
        }

        if (hasRole(auth, "ROLE_PRIMARY_ADMIN")) return;

        if (hasRole(auth, "ROLE_REGIONAL_ADMIN")) {
            if (entryCreator.equalsIgnoreCase(callerEmployeeId)) return;
            UserManagement creator = userRepository.findByEmployeeId(entryCreator).orElse(null);
            String creatorAdmin = creator != null ? creator.getCreatedBy() : null;
            if (creatorAdmin != null && creatorAdmin.equalsIgnoreCase(callerEmployeeId)) return;
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Access denied. You can only act on entries by users you created.");
        }

        if (entryCreator.equalsIgnoreCase(callerEmployeeId)) {
            return;
        }
        if (WorkstationMacUtil.matches(existing.getWorkstationMac(), callerWorkstationMac)) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                "Access denied. You can only act on entries from your desk or that you created.");
    }

    private static boolean hasRole(Authentication auth, String role) {
        return auth.getAuthorities().stream().anyMatch(a -> role.equals(a.getAuthority()));
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

    private static void validateVisitRequest(VisitorRequestDto req) {
        if (req.getReasonForVisit() == null || req.getReasonForVisit().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Reason for visit is required.");
        }
        if (req.getPersonToMeetId() == null || req.getPersonToMeetId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Person to meet is required.");
        }
        if ("__OTHER__".equals(req.getPersonToMeetId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Person to meet must be verified via HRMS mobile lookup.");
        }
    }

    private List<VisitorResponseDto> toResponses(List<Visitor> visitors) {
        if (visitors == null || visitors.isEmpty()) {
            return List.of();
        }
        Set<String> deviceIds = new HashSet<>();
        for (Visitor v : visitors) {
            if (StringUtils.hasText(v.getCheckInDeviceId())) {
                deviceIds.add(v.getCheckInDeviceId());
            }
            if (StringUtils.hasText(v.getLastScanDeviceId())) {
                deviceIds.add(v.getLastScanDeviceId());
            }
        }
        Map<String, DeviceMasterDto> devices = deviceMasterRepository.findByIds(deviceIds);
        return visitors.stream().map(v -> toResponse(v, devices)).toList();
    }

    private VisitorResponseDto toResponse(Visitor v, Map<String, DeviceMasterDto> devices) {
        String locationName = visitorRepository.findLocationName(v.getLocationId()).orElse(null);
        DeviceMasterDto checkInDevice = resolveDevice(devices, v.getCheckInDeviceId());
        DeviceMasterDto lastScanDevice = resolveDevice(devices, v.getLastScanDeviceId());

        return VisitorResponseDto.builder()
                .id(v.getVisitorId())
                .type(v.getEntryType().name())
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
                .govtIdType(v.getGovtIdType() != null ? v.getGovtIdType().name() : null)
                .govtIdNumber(v.getGovtIdNumber())
                .visitType(v.getVisitType() != null ? v.getVisitType().name() : null)
                .checkIn(v.getCheckInTime())
                .checkOut(v.getCheckOutTime())
                .reasonForVisit(v.getReasonForVisit())
                .companyName(v.getCompanyName())
                .createdBy(v.getCreatedBy())
                .workstationMac(v.getWorkstationMac())
                .checkInDeviceId(v.getCheckInDeviceId())
                .checkInDeviceName(checkInDevice != null ? checkInDevice.getDisplayName() : null)
                .lastScanDeviceId(v.getLastScanDeviceId())
                .lastScanDeviceName(lastScanDevice != null ? lastScanDevice.getDisplayName() : null)
                .lastScanAt(v.getLastScanAt())
                .build();
    }

    private DeviceMasterDto resolveDevice(Map<String, DeviceMasterDto> devices, String deviceId) {
        if (!StringUtils.hasText(deviceId)) {
            return null;
        }
        DeviceMasterDto cached = devices.get(deviceId);
        if (cached != null) {
            return cached;
        }
        return deviceMasterRepository.findById(deviceId).orElse(null);
    }
}
