package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.dto.*;
import com.medplus.frontdesk_backend.repository.VisitorRepository;
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

    // ── Create group link ─────────────────────────────────────────────────────

    public PreRegGroupLinkDto createGroupLink(String locationId, String createdBy) {
        String locationName = jdbc.queryForObject(
                "SELECT descriptiveName FROM locationmaster WHERE LocationId = :loc",
                Map.of("loc", locationId), String.class);

        if (locationName == null) {
            throw new IllegalArgumentException("Location not found: " + locationId);
        }

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

    // ── Public: get form data for a group token ───────────────────────────────

    public PreRegFormDataDto getFormData(String groupToken) {
        Map<String, Object> group = getActiveGroup(groupToken);
        String locationId = (String) group.get("locationId");

        String locationName = jdbc.queryForObject(
                "SELECT descriptiveName FROM locationmaster WHERE LocationId = :loc",
                Map.of("loc", locationId), String.class);

        List<PreRegFormDataDto.PersonOption> persons = jdbc.query(
            "SELECT u.employeeid AS id, u.fullName AS name, u.department " +
            "FROM usermaster u " +
            "JOIN usermanagement um ON um.employeeid = u.employeeid " +
            "WHERE um.location = :loc AND um.status = 'ACTIVE' " +
            "ORDER BY u.fullName",
            Map.of("loc", locationId),
            (rs, i) -> new PreRegFormDataDto.PersonOption(
                rs.getString("id"), rs.getString("name"), rs.getString("department"))
        );

        List<String> departments = jdbc.queryForList(
            "SELECT DISTINCT u.department FROM usermaster u " +
            "JOIN usermanagement um ON um.employeeid = u.employeeid " +
            "WHERE um.location = :loc AND um.status = 'ACTIVE' " +
            "ORDER BY u.department",
            Map.of("loc", locationId), String.class
        );

        return new PreRegFormDataDto(locationId, locationName, persons, departments);
    }

    // ── Public: visitor submits their details ─────────────────────────────────

    public PreRegSubmitResponseDto submitRegistration(String groupToken, PreRegSubmitDto dto) {
        Map<String, Object> group = getActiveGroup(groupToken);
        String locationId = (String) group.get("locationId");

        String locationName = jdbc.queryForObject(
                "SELECT descriptiveName FROM locationmaster WHERE LocationId = :loc",
                Map.of("loc", locationId), String.class);

        String token = UUID.randomUUID().toString().replace("-", "");

        // For employees, auto-resolve full name from usermaster if visitor didn't provide it
        String resolvedName = dto.getName();
        if ((resolvedName == null || resolvedName.isBlank())
                && "EMPLOYEE".equalsIgnoreCase(dto.getEntryType())
                && dto.getEmpId() != null) {
            List<String> empNames = jdbc.queryForList(
                "SELECT fullName FROM usermaster WHERE employeeid = :id",
                Map.of("id", dto.getEmpId()), String.class);
            resolvedName = empNames.isEmpty() ? dto.getEmpId() : empNames.get(0);
        }

        // Resolve person name if only ID was provided
        String personName = dto.getPersonName();
        if ((personName == null || personName.isBlank()) && dto.getPersonToMeetId() != null) {
            List<String> names = jdbc.queryForList(
                "SELECT fullName FROM usermaster WHERE employeeid = :id",
                Map.of("id", dto.getPersonToMeetId()), String.class);
            personName = names.isEmpty() ? null : names.get(0);
        }

        jdbc.update(
            "INSERT INTO preregistrations " +
            "(token, groupToken, entryType, name, mobile, empId, email, " +
            " govtIdType, govtIdNumber, " +
            " personToMeetId, personName, hostDepartment, reasonForVisit, locationId) " +
            "VALUES (:token, :grp, :et, :name, :mob, :emp, :email, " +
            "        :idType, :idNum, " +
            "        :ptm, :ptmName, :dept, :reason, :loc)",
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
                .addValue("loc",     locationId)
        );

        log.info("Pre-registration submitted: token={} name={} location={}", token, resolvedName, locationId);
        return new PreRegSubmitResponseDto(token, resolvedName, locationName);
    }

    // ── Public: get submission details by individual token ────────────────────

    public PreRegSubmitResponseDto getSubmission(String token) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT p.name, l.descriptiveName AS locationName " +
            "FROM preregistrations p " +
            "JOIN locationmaster l ON l.LocationId = p.locationId " +
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
            "SELECT p.*, l.descriptiveName AS locationName " +
            "FROM preregistrations p " +
            "JOIN locationmaster l ON l.LocationId = p.locationId " +
            "WHERE p.token = :token",
            Map.of("token", token)
        );
        if (rows.isEmpty()) {
            throw new NoSuchElementException("QR code not found. Please ask the visitor to re-register.");
        }
        Map<String, Object> r = rows.get(0);
        if ("CHECKED_IN".equals(r.get("status"))) {
            throw new IllegalStateException("This QR code has already been used for check-in.");
        }

        PreRegPreviewDto dto = new PreRegPreviewDto();
        dto.setToken(token);
        dto.setName((String) r.get("name"));
        dto.setEntryType((String) r.get("entryType"));
        dto.setMobile((String) r.get("mobile"));
        dto.setEmpId((String) r.get("empId"));
        dto.setGovtIdType((String) r.get("govtIdType"));
        dto.setGovtIdNumber((String) r.get("govtIdNumber"));
        dto.setPersonName((String) r.get("personName"));
        dto.setHostDepartment((String) r.get("hostDepartment"));
        dto.setReasonForVisit((String) r.get("reasonForVisit"));
        dto.setLocationId((String) r.get("locationId"));
        dto.setLocationName((String) r.get("locationName"));
        dto.setStatus((String) r.get("status"));

        // Verify the empId against usermaster (HR master — all employees are here,
        // regardless of whether they have a front-desk login account).
        if ("EMPLOYEE".equals(dto.getEntryType()) && dto.getEmpId() != null) {
            List<Map<String, Object>> empRows = jdbc.queryForList(
                "SELECT fullName, department FROM usermaster WHERE employeeid = :id",
                Map.of("id", dto.getEmpId())
            );
            if (!empRows.isEmpty()) {
                dto.setEmpFound(true);
                dto.setEmpFullName((String) empRows.get(0).get("fullName"));
                dto.setEmpDept((String) empRows.get(0).get("department"));
            }
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

    public List<Map<String, Object>> searchStaff(String query, String preRegToken) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT locationId FROM preregistrations WHERE token = :token",
            Map.of("token", preRegToken)
        );
        if (rows.isEmpty()) throw new NoSuchElementException("Pre-registration token not found.");
        String locationId = (String) rows.get(0).get("locationId");
        String trimmed = query.trim();
        String like = "%" + trimmed.toLowerCase(Locale.ROOT) + "%";
        String likeRaw = "%" + trimmed + "%";

        // Include usermaster rows at this site by work location, not only usermanagement.location (HR sync).
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("loc", locationId)
                .addValue("q", like)
                .addValue("qRaw", likeRaw);

        return jdbc.queryForList(
            "SELECT u.employeeid AS id, u.fullName AS name, u.department " +
            "FROM usermaster u " +
            "LEFT JOIN usermanagement um ON um.employeeid = u.employeeid AND um.status = 'ACTIVE' " +
            "INNER JOIN locationmaster lm ON lm.LocationId = :loc " +
            "WHERE (LOWER(u.fullName) LIKE :q OR LOWER(u.employeeid) LIKE :q OR u.phone LIKE :qRaw) " +
            "AND (um.location = :loc OR LOWER(TRIM(u.worklocation)) = LOWER(TRIM(lm.descriptiveName))) " +
            "ORDER BY u.fullName LIMIT 10",
            params
        );
    }

    // ── Authenticated: validate QR token and return raw pre-reg data ──────────
    // The controller orchestrates the actual check-in via VisitorService.

    public Map<String, Object> validateQrToken(String token) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT p.*, pg.expiresAt " +
            "FROM preregistrations p " +
            "JOIN preregistration_groups pg ON pg.groupToken = p.groupToken " +
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

        Instant expiresAt = ((java.sql.Timestamp) reg.get("expiresAt")).toInstant();
        if (Instant.now().isAfter(expiresAt)) {
            throw new IllegalStateException("This QR code has expired. Please ask the visitor to re-register.");
        }

        return reg;
    }

    // ── Mark pre-registration as checked-in ───────────────────────────────────

    public void markCheckedIn(String token, String visitorId) {
        jdbc.update(
            "UPDATE preregistrations SET status = 'CHECKED_IN', visitorId = :vid WHERE token = :token",
            Map.of("vid", visitorId, "token", token)
        );
        log.info("QR check-in completed: token={} visitorId={}", token, visitorId);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

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
}
