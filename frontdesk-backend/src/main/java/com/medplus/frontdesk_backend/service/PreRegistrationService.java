package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.dto.*;
import com.medplus.frontdesk_backend.repository.VisitorRepository;
import com.medplus.frontdesk_backend.security.AuthorizationHelper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class PreRegistrationService {

    private final NamedParameterJdbcTemplate jdbc;
    private final VisitorRepository visitorRepository;
    private final AuthorizationHelper authorizationHelper;
    private final HrmsService hrmsService;

    // ── Create group link ─────────────────────────────────────────────────────

    public PreRegGroupLinkDto createGroupLink(String locationId, String createdBy) {
        String locationName = resolveLocationName(locationId);

        String groupToken = UUID.randomUUID().toString().replace("-", "");
        Instant expiresAt = Instant.now().plus(24, ChronoUnit.HOURS);

        jdbc.update(
            "INSERT INTO preregistration_groups (groupToken, locationId, expiresAt, createdBy) " +
            "VALUES (:token, :loc, :exp, :by)",
            new MapSqlParameterSource()
                .addValue("token", groupToken)
                .addValue("loc",   locationId)
                .addValue("exp",   java.sql.Timestamp.from(expiresAt))
                .addValue("by",    createdBy)
        );

        log.info("Group link created: {} for location {} by {}", groupToken, locationId, createdBy);
        return new PreRegGroupLinkDto(groupToken, locationId, locationName, expiresAt);
    }

    // ── Public: walk-in form submit (no location, no group token) ────────────
    // Single public form used by all locations. Location is resolved at
    // check-in time from the receptionist's session.

    public PreRegSubmitResponseDto submitWalkIn(PreRegSubmitDto dto) {
        String token = UUID.randomUUID().toString().replace("-", "");

        String empIdToStore = dto.getEmpId();
        String resolvedName = dto.getName();

        if ("EMPLOYEE".equalsIgnoreCase(dto.getEntryType())) {
            UserLookupDto emp = lookupHrmsEmployee(dto.getEmpId())
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Employee not found in HRMS. Please check your Employee ID or HRMS ID."));
            empIdToStore = (emp.getId() != null && !emp.getId().isBlank())
                    ? emp.getId() : dto.getEmpId().trim();
            resolvedName = emp.getName() != null && !emp.getName().isBlank()
                    ? emp.getName() : empIdToStore;
        } else {
            resolvedName = resolveEmployeeDisplayName(dto.getEmpId(), dto.getName(), dto.getEntryType());
        }

        jdbc.update(
            "INSERT INTO preregistrations " +
            "(token, groupToken, entryType, name, mobile, empId, email, " +
            " govtIdType, govtIdNumber, " +
            " personToMeetId, personName, hostDepartment, reasonForVisit, companyName, locationId) " +
            "VALUES (:token, NULL, :et, :name, :mob, :emp, :email, " +
            "        :idType, :idNum, " +
            "        :ptm, :ptmName, :dept, :reason, :company, NULL)",
            new MapSqlParameterSource()
                .addValue("token",   token)
                .addValue("et",      dto.getEntryType() != null ? dto.getEntryType().toUpperCase() : "VISITOR")
                .addValue("name",    resolvedName)
                .addValue("mob",     dto.getMobile())
                .addValue("emp",     empIdToStore)
                .addValue("email",   dto.getEmail())
                .addValue("idType",  dto.getGovtIdType() != null ? dto.getGovtIdType().toUpperCase() : null)
                .addValue("idNum",   dto.getGovtIdNumber())
                .addValue("ptm",     dto.getPersonToMeetId())
                .addValue("ptmName", dto.getPersonName())
                .addValue("dept",    dto.getHostDepartment())
                .addValue("reason",  dto.getReasonForVisit())
                .addValue("company", dto.getCompanyName() != null && !dto.getCompanyName().isBlank()
                        ? dto.getCompanyName().trim() : null)
        );

        log.info("Walk-in pre-registration submitted: token={} name={}", token, resolvedName);
        return new PreRegSubmitResponseDto(token, resolvedName, "MedPlus");
    }

    // ── Public: get form data by locationId (permanent, no expiry) ───────────

    public PreRegFormDataDto getFormDataByLocation(String locationId) {
        String locationName = resolveLocationName(locationId);

        List<PreRegFormDataDto.PersonOption> persons = jdbc.query(
            "SELECT employeeid AS id, fullName AS name, department " +
            "FROM usermanagement WHERE location = :loc ORDER BY fullName",
            Map.of("loc", locationId),
            (rs, i) -> new PreRegFormDataDto.PersonOption(
                rs.getString("id"), rs.getString("name"), rs.getString("department"))
        );

        List<String> departments = jdbc.queryForList(
            "SELECT DISTINCT department FROM usermanagement WHERE location = :loc ORDER BY department",
            Map.of("loc", locationId), String.class
        );

        return new PreRegFormDataDto(locationId, locationName, persons, departments);
    }

    // ── Public: visitor submits for a location (permanent, no expiry) ─────────

    public PreRegSubmitResponseDto submitForLocation(String locationId, PreRegSubmitDto dto) {
        String locationName = resolveLocationName(locationId);

        String token = UUID.randomUUID().toString().replace("-", "");

        String empIdToStore = dto.getEmpId();
        String resolvedName = dto.getName();

        if ("EMPLOYEE".equalsIgnoreCase(dto.getEntryType())) {
            UserLookupDto emp = lookupHrmsEmployee(dto.getEmpId())
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Employee not found in HRMS. Please check your Employee ID or HRMS ID."));
            empIdToStore = (emp.getId() != null && !emp.getId().isBlank())
                    ? emp.getId() : dto.getEmpId().trim();
            resolvedName = emp.getName() != null && !emp.getName().isBlank()
                    ? emp.getName() : empIdToStore;
        } else {
            resolvedName = resolveEmployeeDisplayName(dto.getEmpId(), dto.getName(), dto.getEntryType());
        }

        String personName = dto.getPersonName();
        if ((personName == null || personName.isBlank()) && dto.getPersonToMeetId() != null) {
            List<String> pNames = jdbc.queryForList(
                "SELECT fullName FROM usermanagement WHERE employeeid = :id",
                Map.of("id", dto.getPersonToMeetId()), String.class);
            personName = pNames.isEmpty() ? null : pNames.get(0);
        }

        // Use a synthetic groupToken so it fits the schema (not expiry-checked)
        String syntheticGroup = "LOC-" + locationId;

        jdbc.update(
            "INSERT INTO preregistrations " +
            "(token, groupToken, entryType, name, mobile, empId, email, " +
            " govtIdType, govtIdNumber, " +
            " personToMeetId, personName, hostDepartment, reasonForVisit, companyName, locationId) " +
            "VALUES (:token, :grp, :et, :name, :mob, :emp, :email, " +
            "        :idType, :idNum, " +
            "        :ptm, :ptmName, :dept, :reason, :company, :loc)",
            new MapSqlParameterSource()
                .addValue("token",   token)
                .addValue("grp",     syntheticGroup)
                .addValue("et",      dto.getEntryType().toUpperCase())
                .addValue("name",    resolvedName)
                .addValue("mob",     dto.getMobile())
                .addValue("emp",     empIdToStore)
                .addValue("email",   dto.getEmail())
                .addValue("idType",  dto.getGovtIdType() != null ? dto.getGovtIdType().toUpperCase() : null)
                .addValue("idNum",   dto.getGovtIdNumber())
                .addValue("ptm",     dto.getPersonToMeetId())
                .addValue("ptmName", personName)
                .addValue("dept",    dto.getHostDepartment())
                .addValue("reason",  dto.getReasonForVisit())
                .addValue("company", dto.getCompanyName() != null && !dto.getCompanyName().isBlank()
                        ? dto.getCompanyName().trim() : null)
                .addValue("loc",     locationId)
        );

        log.info("Location pre-registration submitted: token={} name={} location={}", token, resolvedName, locationId);
        return new PreRegSubmitResponseDto(token, resolvedName, locationName);
    }

    // ── Public: get form data for a group token ───────────────────────────────

    public PreRegFormDataDto getFormData(String groupToken) {
        Map<String, Object> group = getActiveGroup(groupToken);
        String locationId = (String) group.get("locationId");

        String locationName = resolveLocationName(locationId);

        List<PreRegFormDataDto.PersonOption> persons = jdbc.query(
            "SELECT employeeid AS id, fullName AS name, department " +
            "FROM usermanagement WHERE location = :loc ORDER BY fullName",
            Map.of("loc", locationId),
            (rs, i) -> new PreRegFormDataDto.PersonOption(
                rs.getString("id"), rs.getString("name"), rs.getString("department"))
        );

        List<String> departments = jdbc.queryForList(
            "SELECT DISTINCT department FROM usermanagement WHERE location = :loc ORDER BY department",
            Map.of("loc", locationId), String.class
        );

        return new PreRegFormDataDto(locationId, locationName, persons, departments);
    }

    // ── Public: visitor submits their details ─────────────────────────────────

    public PreRegSubmitResponseDto submitRegistration(String groupToken, PreRegSubmitDto dto) {
        Map<String, Object> group = getActiveGroup(groupToken);
        String locationId = (String) group.get("locationId");

        String locationName = resolveLocationName(locationId);

        String token = UUID.randomUUID().toString().replace("-", "");

        String resolvedName = resolveEmployeeDisplayName(dto.getEmpId(), dto.getName(), dto.getEntryType());

        // Resolve person name if only ID was provided
        String personName = dto.getPersonName();
        if ((personName == null || personName.isBlank()) && dto.getPersonToMeetId() != null) {
            List<String> names = jdbc.queryForList(
                "SELECT fullName FROM usermanagement WHERE employeeid = :id",
                Map.of("id", dto.getPersonToMeetId()), String.class);
            personName = names.isEmpty() ? null : names.get(0);
        }

        jdbc.update(
            "INSERT INTO preregistrations " +
            "(token, groupToken, entryType, name, mobile, empId, email, " +
            " govtIdType, govtIdNumber, " +
            " personToMeetId, personName, hostDepartment, reasonForVisit, companyName, locationId) " +
            "VALUES (:token, :grp, :et, :name, :mob, :emp, :email, " +
            "        :idType, :idNum, " +
            "        :ptm, :ptmName, :dept, :reason, :company, :loc)",
            new MapSqlParameterSource()
                .addValue("token",   token)
                .addValue("grp",     groupToken)
                .addValue("et",      dto.getEntryType().toUpperCase())
                .addValue("name",    resolvedName)
                .addValue("mob",     dto.getMobile())
                .addValue("emp",     dto.getEmpId())
                .addValue("email",   dto.getEmail())
                .addValue("idType",  dto.getGovtIdType() != null ? dto.getGovtIdType().toUpperCase() : null)
                .addValue("idNum",   dto.getGovtIdNumber())
                .addValue("ptm",     dto.getPersonToMeetId())
                .addValue("ptmName", personName)
                .addValue("dept",    dto.getHostDepartment())
                .addValue("reason",  dto.getReasonForVisit())
                .addValue("company", dto.getCompanyName() != null && !dto.getCompanyName().isBlank()
                        ? dto.getCompanyName().trim() : null)
                .addValue("loc",     locationId)
        );

        log.info("Pre-registration submitted: token={} name={} location={}", token, resolvedName, locationId);
        return new PreRegSubmitResponseDto(token, resolvedName, locationName);
    }

    // ── Public: get submission details by individual token ────────────────────

    public PreRegSubmitResponseDto getSubmission(String token) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT p.name, " + locationNameSubquery("p") + " AS locationName " +
            "FROM preregistrations p " +
            "WHERE p.token = :token",
            Map.of("token", token)
        );
        if (rows.isEmpty()) throw new NoSuchElementException("Pre-registration token not found.");
        Map<String, Object> row = rows.get(0);
        return new PreRegSubmitResponseDto(token, (String) row.get("name"), (String) row.get("locationName"));
    }

    // ── Authenticated: return visitor preview + employee verification ─────────

    public PreRegPreviewDto getPreviewForQr(String token) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT p.*, " + locationNameSubquery("p") + " AS locationName " +
            "FROM preregistrations p " +
            "WHERE p.token = :token",
            Map.of("token", token)
        );
        if (rows.isEmpty()) {
            throw new NoSuchElementException("QR code not found. Please ask the visitor to re-register.");
        }
        Map<String, Object> r = rows.get(0);
        PreRegPreviewDto dto = new PreRegPreviewDto();
        dto.setToken(token);
        dto.setName((String) r.get("name"));
        dto.setEntryType((String) r.get("entryType"));
        dto.setMobile((String) r.get("mobile"));
        dto.setEmpId((String) r.get("empId"));
        dto.setGovtIdType((String) r.get("govtIdType"));
        dto.setGovtIdNumber((String) r.get("govtIdNumber"));
        dto.setPersonToMeetId((String) r.get("personToMeetId"));
        dto.setPersonName((String) r.get("personName"));
        dto.setHostDepartment((String) r.get("hostDepartment"));
        dto.setReasonForVisit((String) r.get("reasonForVisit"));
        dto.setLocationId((String) r.get("locationId"));
        dto.setLocationName((String) r.get("locationName"));
        dto.setStatus((String) r.get("status"));

        if ("CHECKED_IN".equals(r.get("status"))) {
            String linkedVisitorId = r.get("visitorId") != null ? r.get("visitorId").toString() : null;
            if (linkedVisitorId != null && !linkedVisitorId.isBlank()) {
                dto.setAlreadyCheckedIn(true);
                dto.setActiveEntryId(linkedVisitorId);
                return dto;
            }
            throw new IllegalStateException("This QR code has already been used for check-in.");
        }

        if (dto.getPersonToMeetId() != null && !dto.getPersonToMeetId().isBlank()) {
            lookupHrmsEmployee(dto.getPersonToMeetId()).ifPresent(emp -> {
                if (emp.getName() != null && !emp.getName().isBlank()) {
                    dto.setPersonName(emp.getName());
                }
                if (emp.getDepartment() != null && !emp.getDepartment().isBlank()) {
                    dto.setHostDepartment(emp.getDepartment());
                }
            });
        }

        // Verify employee via HRMS (same source as User Management / Add Employee modal).
        if ("EMPLOYEE".equals(dto.getEntryType()) && dto.getEmpId() != null) {
            lookupHrmsEmployee(dto.getEmpId()).ifPresent(emp -> {
                dto.setEmpFound(true);
                dto.setEmpFullName(emp.getName());
                dto.setEmpDept(emp.getDepartment() != null ? emp.getDepartment() : "");
                if (emp.getId() != null && !emp.getId().isBlank()) {
                    dto.setEmpId(emp.getId());
                }
                if ((dto.getName() == null || dto.getName().isBlank())
                        && emp.getName() != null && !emp.getName().isBlank()) {
                    dto.setName(emp.getName());
                }
            });
        }

        // Check for an existing active (CHECKED_IN) entry for this person so the
        // frontend can block the Accept button immediately at preview time.
        visitorRepository.findActiveCheckin(
                dto.getEntryType(),
                dto.getEmpId(),
                dto.getName(),
                dto.getMobile(),
                dto.getLocationId()
        ).ifPresent(existingId -> {
            dto.setAlreadyCheckedIn(true);
            dto.setActiveEntryId(existingId);
        });

        return dto;
    }

    // ── Authenticated: search staff at the location tied to a pre-reg token ──

    public List<Map<String, Object>> searchStaff(String query, String preRegToken, String callerEmpId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT locationId FROM preregistrations WHERE token = :token",
            Map.of("token", preRegToken)
        );
        if (rows.isEmpty()) throw new NoSuchElementException("Pre-registration token not found.");

        String locationId = (String) rows.get(0).get("locationId");

        // Walk-in pre-registrations have no locationId — fall back to the operator's own location.
        // This ensures results are always scoped to where the check-in is happening.
        if (locationId == null || locationId.isBlank()) {
            locationId = callerEmpId != null ? authorizationHelper.getUserLocation(callerEmpId) : null;
        }

        String trimmed = query.trim();
        String like    = "%" + trimmed.toLowerCase(Locale.ROOT) + "%";
        String likeRaw = "%" + trimmed + "%";

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("q",      like)
                .addValue("qRaw",   likeRaw);

        // If we still have no location (e.g. PRIMARY_ADMIN has no fixed location), search all staff.
        if (locationId == null || locationId.isBlank()) {
            return jdbc.queryForList(
                "SELECT u.employeeid AS id, u.fullName AS name, u.department " +
                "FROM usermanagement u " +
                "WHERE (LOWER(u.fullName) LIKE :q OR LOWER(u.employeeid) LIKE :q OR u.phone LIKE :qRaw) " +
                "ORDER BY u.fullName LIMIT 10",
                params
            );
        }

        params.addValue("loc", locationId);
        return jdbc.queryForList(
            "SELECT employeeid AS id, fullName AS name, department " +
            "FROM usermanagement " +
            "WHERE location = :loc " +
            "AND (LOWER(fullName) LIKE :q OR LOWER(employeeid) LIKE :q OR phone LIKE :qRaw) " +
            "ORDER BY fullName LIMIT 10",
            params
        );
    }

    // ── Authenticated: validate QR token and return raw pre-reg data ──────────
    // The controller orchestrates the actual check-in via VisitorService.

    public Map<String, Object> validateQrToken(String token) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT p.*, pg.expiresAt " +
            "FROM preregistrations p " +
            "LEFT JOIN preregistration_groups pg ON pg.groupToken = p.groupToken " +
            "WHERE p.token = :token",
            Map.of("token", token)
        );

        if (rows.isEmpty()) {
            throw new NoSuchElementException("QR code not found. Please ask the visitor to re-register.");
        }

        Map<String, Object> reg = rows.get(0);

        if ("CHECKED_IN".equals(reg.get("status"))) {
            throw new IllegalStateException("This QR code has already been used for check-in.");
        }

        // Only check expiry if the registration came from a group link (not walk-in)
        if (reg.get("expiresAt") != null) {
            Instant expiresAt = ((java.sql.Timestamp) reg.get("expiresAt")).toInstant();
            if (Instant.now().isAfter(expiresAt)) {
                throw new IllegalStateException("This QR code has expired. Please ask the visitor to re-register.");
            }
        }

        return reg;
    }

    // ── Desk walk-in visit pass (prereg row created after receptionist check-in) ─

    public String createDeskCheckInPass(com.medplus.frontdesk_backend.model.Visitor visitor) {
        String token = UUID.randomUUID().toString().replace("-", "");
        jdbc.update(
            "INSERT INTO preregistrations " +
            "(token, groupToken, entryType, name, mobile, empId, email, " +
            " govtIdType, govtIdNumber, " +
            " personToMeetId, personName, hostDepartment, reasonForVisit, companyName, locationId, " +
            " status, visitorId, visitCardSmsStatus) " +
            "VALUES (:token, NULL, :et, :name, :mob, NULL, NULL, " +
            "        :idType, :idNum, " +
            "        :ptm, :ptmName, :dept, :reason, :company, :loc, " +
            "        'CHECKED_IN', :vid, 'PENDING')",
            new MapSqlParameterSource()
                .addValue("token", token)
                .addValue("et", "VISITOR")
                .addValue("name", visitor.getName())
                .addValue("mob", visitor.getMobile())
                .addValue("idType", visitor.getGovtIdType() != null ? visitor.getGovtIdType().name() : null)
                .addValue("idNum", visitor.getGovtIdNumber())
                .addValue("ptm", visitor.getPersonToMeet())
                .addValue("ptmName", visitor.getPersonName())
                .addValue("dept", visitor.getDepartment())
                .addValue("reason", visitor.getReasonForVisit())
                .addValue("company", visitor.getCompanyName())
                .addValue("loc", visitor.getLocationId())
                .addValue("vid", visitor.getVisitorId())
        );
        log.info("Desk visit pass token created: token={} visitorId={}", token, visitor.getVisitorId());
        return token;
    }

    public void updateVisitPassStatus(String token, String smsStatus,
                                      String imageUrl, String shortUrl, String smsError) {
        jdbc.update(
            "UPDATE preregistrations SET " +
            "visitCardSmsStatus = :status, " +
            "visitCardImageUrl = COALESCE(:img, visitCardImageUrl), " +
            "visitCardShortUrl = COALESCE(:short, visitCardShortUrl), " +
            "visitCardSmsError = :err, " +
            "visitCardSentAt = CASE WHEN :status = 'SENT' THEN CURRENT_TIMESTAMP ELSE visitCardSentAt END " +
            "WHERE token = :token",
            new MapSqlParameterSource()
                .addValue("token", token)
                .addValue("status", smsStatus)
                .addValue("img", imageUrl)
                .addValue("short", shortUrl)
                .addValue("err", smsError)
        );

        if (imageUrl != null && !imageUrl.isBlank()) {
            jdbc.update(
                "UPDATE visitorlog vl " +
                "INNER JOIN preregistrations p ON p.visitorId = vl.visitorId " +
                "SET vl.imageUrl = :img " +
                "WHERE p.token = :token",
                Map.of("img", imageUrl, "token", token)
            );
        }
    }

    public Map<String, Object> findPassByVisitorId(String visitorId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT token, name, mobile, visitCardSmsStatus FROM preregistrations " +
            "WHERE visitorId = :vid ORDER BY createdAt DESC LIMIT 1",
            Map.of("vid", visitorId)
        );
        return rows.isEmpty() ? null : rows.get(0);
    }

    // ── Mark pre-registration as checked-in ───────────────────────────────────

    public void markCheckedIn(String token, String visitorId) {
        jdbc.update(
            "UPDATE preregistrations SET status = 'CHECKED_IN', visitorId = :vid WHERE token = :token",
            Map.of("vid", visitorId, "token", token)
        );
        log.info("QR check-in completed: token={} visitorId={}", token, visitorId);
    }

    /**
     * Confirms an employee exists in HRMS before QR check-in completes.
     */
    public boolean isEmployeeVerifiedInHrms(String employeeIdOrHrmsId) {
        return lookupHrmsEmployee(employeeIdOrHrmsId).isPresent();
    }

    /** Public self-check-in form — verify person-to-meet by mobile (no auth). */
    public PreRegHrmsVerifyDto verifyPersonToMeetByPhone(String phone) {
        if (phone == null || phone.replaceAll("\\D", "").length() < 10) {
            return PreRegHrmsVerifyDto.builder()
                    .found(false)
                    .message("Please enter a valid 10-digit mobile number.")
                    .build();
        }
        return hrmsService.lookupByPhoneNo(phone)
                .map(emp -> PreRegHrmsVerifyDto.builder()
                        .found(true)
                        .employeeId(emp.getId())
                        .hrmsId(emp.getHrmsId())
                        .name(emp.getName())
                        .department(emp.getDepartment())
                        .message("Employee verified.")
                        .build())
                .orElse(PreRegHrmsVerifyDto.builder()
                        .found(false)
                        .message("No employee found in HRMS for this mobile number.")
                        .build());
    }

    /** Public self-check-in form — verify Employee ID or HRMS ID (no auth). */
    public PreRegHrmsVerifyDto verifyEmployeeForPublicForm(String idOrHrmsId) {
        if (idOrHrmsId == null || idOrHrmsId.isBlank()) {
            return PreRegHrmsVerifyDto.builder()
                    .found(false)
                    .message("Please enter an Employee ID or HRMS ID.")
                    .build();
        }
        return lookupHrmsEmployee(idOrHrmsId)
                .map(emp -> PreRegHrmsVerifyDto.builder()
                        .found(true)
                        .employeeId(emp.getId())
                        .hrmsId(emp.getHrmsId())
                        .name(emp.getName())
                        .department(emp.getDepartment())
                        .message("Employee verified.")
                        .build())
                .orElse(PreRegHrmsVerifyDto.builder()
                        .found(false)
                        .message("No employee found in HRMS for this ID.")
                        .build());
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * HRMS lookup by employee ID, then by HRMS id (e.g. med1098233).
     */
    private Optional<UserLookupDto> lookupHrmsEmployee(String employeeIdOrHrmsId) {
        if (employeeIdOrHrmsId == null || employeeIdOrHrmsId.isBlank()) {
            return Optional.empty();
        }
        String key = employeeIdOrHrmsId.trim();
        Optional<UserLookupDto> found = hrmsService.lookupByEmployeeId(key);
        if (found.isEmpty()) {
            found = hrmsService.lookupByHrmsId(key);
        }
        return found;
    }

    private String resolveEmployeeDisplayName(String empId, String providedName, String entryType) {
        if (!"EMPLOYEE".equalsIgnoreCase(entryType) || empId == null || empId.isBlank()) {
            return providedName;
        }
        if (providedName != null && !providedName.isBlank()) {
            return providedName;
        }
        return lookupHrmsEmployee(empId)
                .map(UserLookupDto::getName)
                .filter(n -> n != null && !n.isBlank())
                .orElse(empId.trim());
    }

    private Map<String, Object> getActiveGroup(String groupToken) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT groupToken, locationId, expiresAt FROM preregistration_groups WHERE groupToken = :token",
            Map.of("token", groupToken)
        );
        if (rows.isEmpty()) {
            throw new NoSuchElementException("Invalid registration link.");
        }
        Map<String, Object> group = rows.get(0);
        Instant expiresAt = ((java.sql.Timestamp) group.get("expiresAt")).toInstant();
        if (Instant.now().isAfter(expiresAt)) {
            throw new IllegalStateException("This registration link has expired.");
        }
        return group;
    }

    private String resolveLocationName(String locationId) {
        List<String> names = jdbc.queryForList(
                """
                SELECT COALESCE(NULLIF(MAX(locationName), ''), MAX(location)) AS name
                FROM usermanagement
                WHERE location = :loc
                """,
                Map.of("loc", locationId),
                String.class);
        if (names.isEmpty() || names.get(0) == null || names.get(0).isBlank()) {
            throw new NoSuchElementException("Location not found: " + locationId);
        }
        return names.get(0);
    }

    private static String locationNameSubquery(String tableAlias) {
        return "(SELECT COALESCE(NULLIF(MAX(um.locationName), ''), MAX(um.location)) " +
               "FROM usermanagement um WHERE um.location = " + tableAlias + ".locationId)";
    }
}
