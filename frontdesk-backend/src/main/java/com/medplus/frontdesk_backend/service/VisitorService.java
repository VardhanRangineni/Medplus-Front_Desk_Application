package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.dto.DeviceMasterDto;
import com.medplus.frontdesk_backend.dto.EmployeeLookupResponseDto;
import com.medplus.frontdesk_backend.dto.GroupVisitorMemberDto;
import com.medplus.frontdesk_backend.dto.GroupVisitorRequestDto;
import com.medplus.frontdesk_backend.dto.GroupVisitorResponseDto;
import com.medplus.frontdesk_backend.dto.PagedResponseDto;
import com.medplus.frontdesk_backend.dto.PersonToMeetDto;
import com.medplus.frontdesk_backend.dto.StatusCountsDto;
import com.medplus.frontdesk_backend.dto.UserLookupDto;
import com.medplus.frontdesk_backend.dto.VisitorListFilterDto;
import com.medplus.frontdesk_backend.dto.VisitorMovementEventDto;
import com.medplus.frontdesk_backend.dto.VisitorRequestDto;
import com.medplus.frontdesk_backend.dto.VisitorResponseDto;
import com.medplus.frontdesk_backend.model.EntryType;
import com.medplus.frontdesk_backend.model.GovtIdType;
import com.medplus.frontdesk_backend.model.UserRole;
import com.medplus.frontdesk_backend.model.VisitStatus;
import com.medplus.frontdesk_backend.model.VisitType;
import com.medplus.frontdesk_backend.model.Visitor;
import com.medplus.frontdesk_backend.repository.DeviceMasterRepository;
import com.medplus.frontdesk_backend.repository.UserRepository;
import com.medplus.frontdesk_backend.repository.VisitorRepository;
import com.medplus.frontdesk_backend.security.AuthorizationHelper;
import com.medplus.frontdesk_backend.util.LegacyLocationResolver;
import com.medplus.frontdesk_backend.util.WorkstationMacUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.dao.DuplicateKeyException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
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
    private final HostNotifyService hostNotifyService;

    public VisitorService(VisitorRepository visitorRepository, UserRepository userRepository,
                          HrmsService hrmsService, VisitPassService visitPassService,
                          OperationalLocationService operationalLocationService,
                          LocationScopeService locationScopeService,
                          VisitorScanService visitorScanService,
                          DeviceMasterRepository deviceMasterRepository,
                          AuthorizationHelper authorizationHelper,
                          HostNotifyService hostNotifyService) {
        this.visitorRepository = visitorRepository;
        this.userRepository = userRepository;
        this.hrmsService = hrmsService;
        this.visitPassService = visitPassService;
        this.operationalLocationService = operationalLocationService;
        this.locationScopeService = locationScopeService;
        this.visitorScanService = visitorScanService;
        this.deviceMasterRepository = deviceMasterRepository;
        this.authorizationHelper = authorizationHelper;
        this.hostNotifyService = hostNotifyService;
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
    @Retryable(
        retryFor = { DuplicateKeyException.class },
        maxAttempts = 3,
        backoff = @Backoff(delay = 100, multiplier = 2.0)
    )
    @Transactional
    public VisitorResponseDto checkIn(VisitorRequestDto req, String createdBy, String workstationMac,
                                      String existingPreregToken) {

        authorizationHelper.requireCheckInPermission();

        validateVisitRequest(req);

        EntryType entryType = parseEntryType(req.getEntryType());
        PersonToMeetDto person = resolvePersonToMeet(req.getPersonToMeetId());

        // Always store the person-to-meet (host) department — for both visitors and employees.
        String entryDepartment = person.getDepartment();

        String mobile = req.getMobile() != null ? req.getMobile().trim() : null;
        String empId = req.getEmpId() != null ? req.getEmpId().trim() : null;
        // Keep a contact number on employee check-ins for the view/record trail.
        if (entryType == EntryType.EMPLOYEE && !hasText(mobile) && hasText(empId)) {
            mobile = hrmsService.lookupByEmployeeId(empId)
                    .map(UserLookupDto::getPhone)
                    .map(phone -> {
                        String normalized = HostNotifyService.normalizeMobile(phone);
                        if (normalized != null) return normalized;
                        if (phone == null) return null;
                        String digits = phone.replaceAll("\\D", "");
                        return digits.isBlank() ? null : digits;
                    })
                    .orElse(null);
        } else if (hasText(mobile)) {
            String normalized = HostNotifyService.normalizeMobile(mobile);
            mobile = normalized != null ? normalized : mobile.replaceAll("\\D", "");
        }

        // Prefer operator's assigned kiosk (desk identity), not only PC MAC.
        var deviceOpt = operationalLocationService.resolveDeskDevice(createdBy, workstationMac);
        String locationId = deviceOpt
                .map(com.medplus.frontdesk_backend.dto.DeviceMasterDto::getLocationId)
                .filter(id -> id != null && !id.isBlank())
                .orElseGet(() -> operationalLocationService.resolveForUser(createdBy, workstationMac));
        String checkInDeviceId = deviceOpt.map(com.medplus.frontdesk_backend.dto.DeviceMasterDto::getDeviceId)
                .orElse(null);

        VisitType visitType = parseVisitTypeForSingle(req.getVisitType());

        // Guard: block duplicate active check-ins for the same person at the same location
        visitorRepository.findActiveCheckin(
                req.getEntryType(),
                empId,
                req.getName() != null  ? req.getName().trim()  : null,
                mobile,
                locationId
        ).ifPresent(existingId -> {
            String who = entryType == EntryType.EMPLOYEE
                    ? "Employee " + empId
                    : req.getName();
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    who + " is already checked in (entry " + existingId + "). " +
                    "Please check out the existing entry before checking in again.");
        });

        String hostPhone = HostNotifyService.normalizeMobile(person.getPhone());
        boolean needsHostApproval = hostNotifyService.isKeyManagementHost(hostPhone);

        Visitor visitor = Visitor.builder()
                .visitorId(null)
                .visitType(visitType)
                .groupId(null)
                .entryType(entryType)
                .name(req.getName().trim())
                .mobile(mobile)
                .empId(empId)
                .status(needsHostApproval ? VisitStatus.PENDING_APPROVAL : VisitStatus.CHECKED_IN)
                .personToMeet(person.getId())
                .personName(person.getName())
                .personToMeetPhone(hostPhone)
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
        log.info("Check-in created: {} ({}) card={} by {} status={}",
                 visitor.getVisitorId(), req.getName(), req.getCardNumber(), createdBy, visitor.getStatus());

        // Key Management host SMS (after commit) when person-to-meet mobile is registered.
        if (needsHostApproval) {
            hostNotifyService.notifyIfKeyManagementHost(hostPhone, person.getName());
        }

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

    /**
     * Creates a group visit: one MED-GROUP-#### and N MED-GV-#### member rows.
     * Host approval SMS is sent once for the whole group.
     */
    @Retryable(
        retryFor = { DuplicateKeyException.class },
        maxAttempts = 3,
        backoff = @Backoff(delay = 100, multiplier = 2.0)
    )
    @Transactional
    public GroupVisitorResponseDto checkInGroup(GroupVisitorRequestDto req, String createdBy,
                                                String workstationMac) {
        authorizationHelper.requireCheckInPermission();

        if (req.getMembers() == null || req.getMembers().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "At least one group member is required.");
        }
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

        EntryType entryType = parseEntryType(req.getEntryType());
        PersonToMeetDto person = resolvePersonToMeet(req.getPersonToMeetId());
        String entryDepartment = person.getDepartment();

        var deviceOpt = operationalLocationService.resolveDeskDevice(createdBy, workstationMac);
        String locationId = deviceOpt
                .map(com.medplus.frontdesk_backend.dto.DeviceMasterDto::getLocationId)
                .filter(id -> id != null && !id.isBlank())
                .orElseGet(() -> operationalLocationService.resolveForUser(createdBy, workstationMac));
        String checkInDeviceId = deviceOpt.map(com.medplus.frontdesk_backend.dto.DeviceMasterDto::getDeviceId)
                .orElse(null);

        String hostPhone = HostNotifyService.normalizeMobile(person.getPhone());
        boolean needsHostApproval = hostNotifyService.isKeyManagementHost(hostPhone);
        VisitStatus status = needsHostApproval ? VisitStatus.PENDING_APPROVAL : VisitStatus.CHECKED_IN;
        LocalDateTime now = LocalDateTime.now();
        String companyName = req.getCompanyName() != null && !req.getCompanyName().isBlank()
                ? req.getCompanyName().trim() : null;
        GovtIdType govtIdType = parseGovtIdType(req.getGovtIdType());
        String govtIdNumber = req.getGovtIdNumber() != null ? req.getGovtIdNumber().trim() : null;
        String workstation = WorkstationMacUtil.toStoredValue(workstationMac);

        String groupId = String.format("MED-GROUP-%04d", visitorRepository.nextGroupSequence());
        List<Visitor> created = new ArrayList<>();

        for (GroupVisitorMemberDto member : req.getMembers()) {
            if (member == null || !hasText(member.getName())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Each group member requires a name.");
            }
            String name = member.getName().trim();
            String empId = hasText(member.getEmpId()) ? member.getEmpId().trim() : null;
            String mobile = member.getMobile() != null ? member.getMobile().trim() : null;

            if (entryType == EntryType.EMPLOYEE) {
                if (!hasText(empId)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Each employee group member requires an employee ID.");
                }
                if (!hasText(mobile)) {
                    mobile = hrmsService.lookupByEmployeeId(empId)
                            .map(UserLookupDto::getPhone)
                            .map(phone -> {
                                String normalized = HostNotifyService.normalizeMobile(phone);
                                if (normalized != null) return normalized;
                                if (phone == null) return null;
                                String digits = phone.replaceAll("\\D", "");
                                return digits.isBlank() ? null : digits;
                            })
                            .orElse(null);
                } else {
                    String normalized = HostNotifyService.normalizeMobile(mobile);
                    mobile = normalized != null ? normalized : mobile.replaceAll("\\D", "");
                }
            } else {
                if (!hasText(mobile)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Each visitor group member requires a mobile number.");
                }
                String normalized = HostNotifyService.normalizeMobile(mobile);
                mobile = normalized != null ? normalized : mobile.replaceAll("\\D", "");
                empId = null;
            }

            final String memberEmpId = empId;
            final String memberMobile = mobile;
            final String memberName = name;
            String entryTypeName = entryType.name();
            visitorRepository.findActiveCheckin(
                    entryTypeName, memberEmpId, memberName, memberMobile, locationId
            ).ifPresent(existingId -> {
                String who = entryType == EntryType.EMPLOYEE ? "Employee " + memberEmpId : memberName;
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        who + " is already checked in (entry " + existingId + "). " +
                        "Please check out the existing entry before checking in again.");
            });

            Integer memberCard = member.getCardNumber() != null
                    ? member.getCardNumber()
                    : req.getCardNumber();
            Visitor visitor = Visitor.builder()
                    .visitorId(null)
                    .visitType(VisitType.GROUP)
                    .groupId(groupId)
                    .entryType(entryType)
                    .name(memberName)
                    .mobile(memberMobile)
                    .empId(memberEmpId)
                    .status(status)
                    .personToMeet(person.getId())
                    .personName(person.getName())
                    .personToMeetPhone(hostPhone)
                    .department(entryDepartment)
                    .locationId(locationId)
                    .cardNumber(memberCard)
                    .govtIdType(govtIdType)
                    .govtIdNumber(govtIdNumber)
                    .checkInTime(now)
                    .reasonForVisit(req.getReasonForVisit())
                    .companyName(companyName)
                    .createdBy(createdBy)
                    .workstationMac(workstation)
                    .checkInDeviceId(checkInDeviceId)
                    .lastScanDeviceId(checkInDeviceId)
                    .lastScanAt(checkInDeviceId != null ? now : null)
                    .build();

            visitorRepository.insertVisitor(visitor);
            deviceOpt.ifPresent(device -> visitorScanService.recordCheckInScan(
                    visitor, device, createdBy, workstationMac, null));
            created.add(visitor);
            log.info("Group check-in member: {} group={} ({}) by {}",
                    visitor.getVisitorId(), groupId, name, createdBy);
        }

        // One host SMS for the whole group.
        if (needsHostApproval) {
            hostNotifyService.notifyIfKeyManagementHost(hostPhone, person.getName());
        }

        List<VisitorResponseDto> memberDtos = toResponses(created);
        for (int i = 0; i < created.size(); i++) {
            Visitor visitor = created.get(i);
            VisitorResponseDto dto = memberDtos.get(i);
            if (visitPassService.isEligible(visitor)) {
                String passToken = visitPassService.initiateDeskWalkInPass(visitor);
                dto.setVisitPassToken(passToken);
                dto.setVisitPassSmsStatus("PENDING");
                dto.setVisitPassMessage("Visit pass is being sent to the visitor's mobile.");
            } else {
                dto.setVisitPassSmsStatus("SKIPPED");
            }
        }

        return GroupVisitorResponseDto.builder()
                .groupId(groupId)
                .members(memberDtos)
                .build();
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    /** Single-entry check-in only supports INDIVIDUAL (use /group for GROUP). */
    private static VisitType parseVisitTypeForSingle(String raw) {
        if (raw == null || raw.isBlank()) {
            return VisitType.INDIVIDUAL;
        }
        try {
            VisitType type = VisitType.valueOf(raw.trim().toUpperCase());
            if (type == VisitType.GROUP) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Use POST /api/visitors/group for group visits.");
            }
            return type;
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid visitType '" + raw + "'. Must be INDIVIDUAL or GROUP.");
        }
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
                                                           String entryType,
                                                           String name,
                                                           String contactQuery,
                                                           String personToMeet,
                                                           String cardNumber,
                                                           int page, int size,
                                                           String workstationMac,
                                                           Authentication auth) {
        String dept       = resolveDepartmentFilter(blankToNull(department), auth);
        String dbStatus   = labelToDbStatus(status);
        String createdBy  = resolveCreatedByFilter(callerEmployeeId, createdByParam, auth);
        int    offset     = page * size;
        VisitorListFilterDto columnFilters = VisitorListFilterDto.of(
                entryType, name, contactQuery, personToMeet, cardNumber);

        String locationId = locationScopeService.resolveReadScope(
                callerEmployeeId, workstationMac, auth, locationIdParam, allLocations);
        List<Visitor> rows  = visitorRepository.findPaged(
                locationId, from, to, dept, dbStatus, createdBy, columnFilters, offset, size);
        long total = visitorRepository.countFiltered(
                locationId, from, to, dept, dbStatus, createdBy, columnFilters);
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
                                                              String entryType,
                                                              String name,
                                                              String contactQuery,
                                                              String personToMeet,
                                                              String cardNumber,
                                                              int page, int size,
                                                              String workstationMac,
                                                              Authentication auth) {
        if (query == null || query.isBlank()) {
            return getEntries(callerEmployeeId, from, to, locationIdParam, allLocations, department, status,
                    createdByParam, entryType, name, contactQuery, personToMeet, cardNumber,
                    page, size, workstationMac, auth);
        }

        String dept      = resolveDepartmentFilter(blankToNull(department), auth);
        String dbStatus  = labelToDbStatus(status);
        String createdBy = resolveCreatedByFilter(callerEmployeeId, createdByParam, auth);
        int    offset    = page * size;
        VisitorListFilterDto columnFilters = VisitorListFilterDto.of(
                entryType, name, contactQuery, personToMeet, cardNumber);

        String locationId = locationScopeService.resolveReadScope(
                callerEmployeeId, workstationMac, auth, locationIdParam, allLocations);
        List<Visitor> rows = visitorRepository.searchPaged(
                locationId, from, to, query, dept, dbStatus, createdBy, columnFilters, offset, size);
        long total = visitorRepository.countSearch(
                locationId, from, to, query, dept, dbStatus, createdBy, columnFilters);
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
        String dept = resolveDepartmentFilter(null, auth);
        if (locationId == null) {
            return toResponses(
                    dept != null
                            ? visitorRepository.findRecentByDepartment(dept, 20)
                            : visitorRepository.findRecentAll(20));
        }
        return toResponses(
                dept != null
                        ? visitorRepository.findRecentByLocationAndDepartment(locationId, dept, 20)
                        : visitorRepository.findRecent(locationId, 20));
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
        String    dept       = resolveDepartmentFilter(
                (department != null && !department.isBlank()) ? department : null, auth);

        String locationId = locationScopeService.resolveReadScope(
                callerEmployeeId, workstationMac, auth, locationIdParam, allLocations);
        List<Visitor> rows = visitorRepository.findPaged(
                locationId, exportDate, exportDate, dept, null, null, null, 0, Integer.MAX_VALUE);

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
        assertCanEditEntry(existing, callerEmployeeId, workstationMac, auth);

        validateVisitRequest(req);

        PersonToMeetDto person = resolvePersonToMeet(req.getPersonToMeetId());

        existing.setName(req.getName().trim());
        String updateMobile = req.getMobile() != null ? req.getMobile().trim() : null;
        if (hasText(updateMobile)) {
            String normalized = HostNotifyService.normalizeMobile(updateMobile);
            existing.setMobile(normalized != null ? normalized : updateMobile.replaceAll("\\D", ""));
        } else if (existing.getEntryType() != EntryType.EMPLOYEE) {
            existing.setMobile(null);
        }
        // Employee edits without mobile keep the stored contact number.
        existing.setEmpId(req.getEmpId() != null ? req.getEmpId().trim() : null);
        existing.setPersonToMeet(person.getId());
        existing.setPersonName(person.getName());
        existing.setPersonToMeetPhone(HostNotifyService.normalizeMobile(person.getPhone()));
        existing.setDepartment(person.getDepartment());
        existing.setCardNumber(req.getCardNumber());
        existing.setGovtIdType(parseGovtIdType(req.getGovtIdType()));
        existing.setGovtIdNumber(req.getGovtIdNumber() != null ? req.getGovtIdNumber().trim() : null);
        existing.setReasonForVisit(req.getReasonForVisit());
        existing.setCompanyName(req.getCompanyName() != null && !req.getCompanyName().isBlank()
                ? req.getCompanyName().trim() : null);
        // Preserve original creator; audit the editor separately.
        existing.setModifiedBy(callerEmployeeId);

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
        if (existing.getStatus() == VisitStatus.REJECTED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Rejected entries cannot be checked out: " + visitorId);
        }
        if (!existing.getStatus().isOnSite()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Only on-site entries can be checked out: " + visitorId);
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
     * DEPT_HEAD: automatically scoped to their own department (from usermanagement).
     * Even if the frontend sends a different department, it is ignored.
     * For all other roles: use the filter value as-is (may be null = no filter).
     */
    private String resolveDepartmentFilter(String deptFromUi, Authentication auth) {
        if (authorizationHelper.isDeptHead(auth)) {
            String callerEmpId = auth.getName();
            String callerDept = authorizationHelper.getUserDepartment(callerEmpId);
            if (StringUtils.hasText(callerDept)) {
                return callerDept;
            }
            // Fallback: if department not configured in usermanagement, no filter.
            log.warn("DEPT_HEAD {} has no department in usermanagement — skipping department filter", callerEmpId);
        }
        return deptFromUi;
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
            case "checked-in", "pending-approval", "approved" -> "CHECKED_IN";
            case "checked-out" -> "CHECKED_OUT";
            case "rejected" -> "REJECTED";
            default -> null;
        };
    }

    private static String maskPhone(String phone) {
        if (phone == null || phone.length() < 4) return "****";
        return phone.substring(0, 2) + "****" + phone.substring(phone.length() - 2);
    }

    /**
     * Edit access: checked-in only, plus same location rules as checkout.
     */
    private void assertCanEditEntry(Visitor existing, String callerEmployeeId,
                                    String callerWorkstationMac, Authentication auth) {
        if (!existing.getStatus().isOnSite()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Only on-site (pending or checked-in) entries can be edited.");
        }
        assertCanMutateEntry(existing, callerEmployeeId, callerWorkstationMac, auth);
    }

    /**
     * Mutation access (checkout + edit location gate):
     * PRIMARY_ADMIN may act on any entry.
     * REGIONAL_ADMIN may act on entries at their assigned locations.
     * DEPT_HEAD is view-only — no mutation allowed.
     * Others (RECEPTIONIST) must match the entry location (operational / kiosk location).
     */
    private void assertCanMutateEntry(Visitor existing, String callerEmployeeId,
                                      String callerWorkstationMac, Authentication auth) {
        if (auth == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied.");
        }
        if (hasRole(auth, "ROLE_PRIMARY_ADMIN")) {
            return;
        }

        // DEPT_HEAD is view-only — cannot check out or edit entries
        if (authorizationHelper.isDeptHead(auth)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Department heads have view-only access and cannot modify entries.");
        }

        String entryLocation = LegacyLocationResolver.resolve(existing.getLocationId());
        if (!StringUtils.hasText(entryLocation)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Access denied. Entry has no location mapping.");
        }

        if (hasRole(auth, "ROLE_REGIONAL_ADMIN")) {
            List<String> allowed = userRepository.findLocationIdsByEmployeeId(callerEmployeeId);
            boolean ok = allowed.stream().anyMatch(id ->
                    entryLocation.equalsIgnoreCase(LegacyLocationResolver.resolve(id)));
            if (ok) {
                return;
            }
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Access denied. You can only check out entries at your assigned locations.");
        }

        String callerLocation = LegacyLocationResolver.resolve(
                operationalLocationService.resolveForUser(callerEmployeeId, callerWorkstationMac));
        if (entryLocation.equalsIgnoreCase(callerLocation)) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                "Access denied. You can only check out entries at your location.");
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
                .groupId(v.getGroupId())
                .checkIn(v.getCheckInTime())
                .checkOut(v.getCheckOutTime())
                .reasonForVisit(v.getReasonForVisit())
                .approvedAt(v.getApprovedAt())
                .rejectedAt(v.getRejectedAt())
                .rejectionRemarks(v.getRejectionRemarks())
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
