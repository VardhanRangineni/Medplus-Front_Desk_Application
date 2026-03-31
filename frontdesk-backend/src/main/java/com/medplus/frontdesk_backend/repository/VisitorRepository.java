package com.medplus.frontdesk_backend.repository;

import com.medplus.frontdesk_backend.dto.PersonToMeetDto;
import com.medplus.frontdesk_backend.model.VisitStatus;
import com.medplus.frontdesk_backend.model.VisitType;
import com.medplus.frontdesk_backend.model.Visitor;
import com.medplus.frontdesk_backend.model.VisitorMember;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class VisitorRepository {

    private final NamedParameterJdbcTemplate jdbc;

    // ── ID generation ─────────────────────────────────────────────────────────

    /**
     * Returns the next sequential number for a visitor ID.
     * For INDIVIDUAL visits: counts MED-V-NNNN rows.
     * For GROUP visits:      counts MED-GV-NNNN rows.
     */
    public int nextVisitorSequence(VisitType visitType) {
        String sql = """
                SELECT COALESCE(
                    MAX(CAST(SUBSTRING_INDEX(visitorId, '-', -1) AS UNSIGNED)), 0
                ) + 1
                FROM visitorlog
                WHERE visitType = :visitType
                """;
        Integer next = jdbc.queryForObject(sql,
                new MapSqlParameterSource("visitType", visitType.name()), Integer.class);
        return next == null ? 1 : next;
    }

    /**
     * Returns the next sequential number for a visitor-member ID (MED-GM-NNNN).
     */
    public int nextMemberSequence() {
        String sql = """
                SELECT COALESCE(
                    MAX(CAST(SUBSTRING_INDEX(memberId, '-', -1) AS UNSIGNED)), 0
                ) + 1
                FROM visitormember
                """;
        Integer next = jdbc.queryForObject(sql, new MapSqlParameterSource(), Integer.class);
        return next == null ? 1 : next;
    }

    // ── Visitor CRUD ──────────────────────────────────────────────────────────

    public void insertVisitor(Visitor v) {
        String sql = """
                INSERT INTO visitorlog
                    (visitorId, visitType, entryType, name, mobile, empId,
                     status, personToMeet, personName, department,
                     locationId, cardNumber, checkInTime, reasonForVisit, createdBy)
                VALUES
                    (:visitorId, :visitType, :entryType, :name, :mobile, :empId,
                     :status, :personToMeet, :personName, :department,
                     :locationId, :cardNumber, :checkInTime, :reasonForVisit, :createdBy)
                """;
        jdbc.update(sql, new MapSqlParameterSource()
                .addValue("visitorId",      v.getVisitorId())
                .addValue("visitType",      v.getVisitType().name())
                .addValue("entryType",      v.getEntryType())
                .addValue("name",           v.getName())
                .addValue("mobile",         v.getMobile())
                .addValue("empId",          v.getEmpId())
                .addValue("status",         v.getStatus().name())
                .addValue("personToMeet",   v.getPersonToMeet())
                .addValue("personName",     v.getPersonName())
                .addValue("department",     v.getDepartment())
                .addValue("locationId",     v.getLocationId())
                .addValue("cardNumber",     v.getCardNumber())
                .addValue("checkInTime",    v.getCheckInTime())
                .addValue("reasonForVisit", v.getReasonForVisit())
                .addValue("createdBy",      v.getCreatedBy())
        );
    }

    public void updateVisitor(Visitor v) {
        String sql = """
                UPDATE visitorlog
                SET name           = :name,
                    mobile         = :mobile,
                    empId          = :empId,
                    personToMeet   = :personToMeet,
                    personName     = :personName,
                    department     = :department,
                    cardNumber     = :cardNumber,
                    reasonForVisit = :reasonForVisit,
                    modifiedBy     = :modifiedBy
                WHERE visitorId = :visitorId
                """;
        jdbc.update(sql, new MapSqlParameterSource()
                .addValue("visitorId",      v.getVisitorId())
                .addValue("name",           v.getName())
                .addValue("mobile",         v.getMobile())
                .addValue("empId",          v.getEmpId())
                .addValue("personToMeet",   v.getPersonToMeet())
                .addValue("personName",     v.getPersonName())
                .addValue("department",     v.getDepartment())
                .addValue("cardNumber",     v.getCardNumber())
                .addValue("reasonForVisit", v.getReasonForVisit())
                .addValue("modifiedBy",     v.getCreatedBy())
        );
    }

    public void checkOutVisitor(String visitorId, LocalDateTime checkOutTime, String modifiedBy) {
        String sql = """
                UPDATE visitorlog
                SET status = 'CHECKED_OUT', checkOutTime = :checkOutTime, modifiedBy = :modifiedBy
                WHERE visitorId = :visitorId
                """;
        jdbc.update(sql, new MapSqlParameterSource()
                .addValue("visitorId",    visitorId)
                .addValue("checkOutTime", checkOutTime)
                .addValue("modifiedBy",   modifiedBy)
        );
    }

    public Optional<Visitor> findById(String visitorId) {
        String sql = """
                SELECT visitorId, visitType, entryType, name, mobile, empId,
                       status, personToMeet, personName, department,
                       locationId, cardNumber, checkInTime, checkOutTime, reasonForVisit, createdBy
                FROM visitorlog
                WHERE visitorId = :visitorId
                """;
        List<Visitor> rows = jdbc.query(sql,
                new MapSqlParameterSource("visitorId", visitorId), this::mapVisitorRow);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    /**
     * Returns all entries for a location on a given date (calendar day).
     * If date is null, returns today's entries.
     */
    public List<Visitor> findByLocationAndDate(String locationId, java.time.LocalDate date) {
        LocalDateTime start = date.atStartOfDay();
        LocalDateTime end   = date.plusDays(1).atStartOfDay();
        String sql = """
                SELECT visitorId, visitType, entryType, name, mobile, empId,
                       status, personToMeet, personName, department,
                       locationId, cardNumber, checkInTime, checkOutTime, reasonForVisit, createdBy
                FROM visitorlog
                WHERE locationId  = :locationId
                  AND checkInTime >= :start
                  AND checkInTime <  :end
                ORDER BY checkInTime DESC
                """;
        return jdbc.query(sql, new MapSqlParameterSource()
                .addValue("locationId", locationId)
                .addValue("start",      start)
                .addValue("end",        end),
                this::mapVisitorRow);
    }

    /**
     * Full-text search within a location + date.
     * Searches: name, mobile, empId, personName.
     */
    public List<Visitor> searchByLocationAndDate(String locationId, java.time.LocalDate date, String query) {
        LocalDateTime start = date.atStartOfDay();
        LocalDateTime end   = date.plusDays(1).atStartOfDay();
        String like = "%" + query.trim().toLowerCase() + "%";
        String sql = """
                SELECT visitorId, visitType, entryType, name, mobile, empId,
                       status, personToMeet, personName, department,
                       locationId, cardNumber, checkInTime, checkOutTime, reasonForVisit, createdBy
                FROM visitorlog
                WHERE locationId  = :locationId
                  AND checkInTime >= :start
                  AND checkInTime <  :end
                  AND (
                      LOWER(name)       LIKE :q
                   OR LOWER(mobile)     LIKE :q
                   OR LOWER(empId)      LIKE :q
                   OR LOWER(personName) LIKE :q
                  )
                ORDER BY checkInTime DESC
                """;
        return jdbc.query(sql, new MapSqlParameterSource()
                .addValue("locationId", locationId)
                .addValue("start",      start)
                .addValue("end",        end)
                .addValue("q",          like),
                this::mapVisitorRow);
    }

    // ── VisitorMember CRUD ────────────────────────────────────────────────────

    public void insertMember(VisitorMember m) {
        String sql = """
                INSERT INTO visitormember (memberId, visitorId, name, cardNumber, status)
                VALUES (:memberId, :visitorId, :name, :cardNumber, :status)
                """;
        jdbc.update(sql, new MapSqlParameterSource()
                .addValue("memberId",   m.getMemberId())
                .addValue("visitorId",  m.getVisitorId())
                .addValue("name",       m.getName())
                .addValue("cardNumber", m.getCardNumber())
                .addValue("status",     m.getStatus().name())
        );
    }

    public void checkOutMember(String memberId, LocalDateTime checkOutTime) {
        String sql = """
                UPDATE visitormember
                SET status = 'CHECKED_OUT', checkOutTime = :checkOutTime
                WHERE memberId = :memberId
                """;
        jdbc.update(sql, new MapSqlParameterSource()
                .addValue("memberId",    memberId)
                .addValue("checkOutTime", checkOutTime)
        );
    }

    public List<VisitorMember> findMembersByVisitorId(String visitorId) {
        String sql = """
                SELECT memberId, visitorId, name, cardNumber, status, checkOutTime
                FROM visitormember
                WHERE visitorId = :visitorId
                ORDER BY createdAt
                """;
        return jdbc.query(sql, new MapSqlParameterSource("visitorId", visitorId),
                (rs, rowNum) -> VisitorMember.builder()
                        .memberId(rs.getString("memberId"))
                        .visitorId(rs.getString("visitorId"))
                        .name(rs.getString("name"))
                        .cardNumber(rs.getObject("cardNumber", Integer.class))
                        .status(VisitStatus.valueOf(rs.getString("status")))
                        .checkOutTime(rs.getTimestamp("checkOutTime") != null
                                ? rs.getTimestamp("checkOutTime").toLocalDateTime() : null)
                        .build()
        );
    }

    public Optional<VisitorMember> findMemberById(String memberId) {
        String sql = """
                SELECT memberId, visitorId, name, cardNumber, status, checkOutTime
                FROM visitormember
                WHERE memberId = :memberId
                """;
        List<VisitorMember> rows = jdbc.query(sql,
                new MapSqlParameterSource("memberId", memberId),
                (rs, rowNum) -> VisitorMember.builder()
                        .memberId(rs.getString("memberId"))
                        .visitorId(rs.getString("visitorId"))
                        .name(rs.getString("name"))
                        .cardNumber(rs.getObject("cardNumber", Integer.class))
                        .status(VisitStatus.valueOf(rs.getString("status")))
                        .checkOutTime(rs.getTimestamp("checkOutTime") != null
                                ? rs.getTimestamp("checkOutTime").toLocalDateTime() : null)
                        .build()
        );
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    // ── Person-to-meet search ─────────────────────────────────────────────────

    /**
     * Searches usermaster employees at the given location.
     * Matches fullName, employeeid, or phone using a case-insensitive LIKE.
     * The location is resolved via locationmaster.descriptiveName = usermaster.worklocation.
     */
    public List<PersonToMeetDto> searchPersonsToMeet(String locationId, String query) {
        String like = "%" + query.trim().toLowerCase() + "%";
        String sql = """
                SELECT um.employeeid, um.fullName, um.phone, um.department, um.designation
                FROM usermaster um
                JOIN locationmaster lm ON lm.descriptiveName = um.worklocation
                WHERE lm.LocationId = :locationId
                  AND (
                      LOWER(um.fullName)   LIKE :q
                   OR LOWER(um.employeeid) LIKE :q
                   OR um.phone            LIKE :q
                  )
                ORDER BY um.fullName
                LIMIT 20
                """;
        return jdbc.query(sql, new MapSqlParameterSource()
                .addValue("locationId", locationId)
                .addValue("q",          like),
                (rs, rowNum) -> PersonToMeetDto.builder()
                        .id(rs.getString("employeeid"))
                        .name(rs.getString("fullName"))
                        .phone(rs.getString("phone"))
                        .department(rs.getString("department"))
                        .designation(rs.getString("designation"))
                        .build()
        );
    }

    /**
     * Returns ALL employees at the given location (no search filter).
     * Used by the "Person to Meet" dropdown to populate the full list.
     */
    public List<PersonToMeetDto> findAllPersonsAtLocation(String locationId) {
        String sql = """
                SELECT um.employeeid, um.fullName, um.phone, um.department, um.designation
                FROM usermaster um
                JOIN locationmaster lm ON lm.descriptiveName = um.worklocation
                WHERE lm.LocationId = :locationId
                ORDER BY um.fullName
                """;
        return jdbc.query(sql, new MapSqlParameterSource("locationId", locationId),
                (rs, rowNum) -> PersonToMeetDto.builder()
                        .id(rs.getString("employeeid"))
                        .name(rs.getString("fullName"))
                        .phone(rs.getString("phone"))
                        .department(rs.getString("department"))
                        .designation(rs.getString("designation"))
                        .build()
        );
    }

    /**
     * Returns distinct department names from usermaster at the given location.
     * Used to populate the "Host Department" dropdown.
     */
    public List<String> findDistinctDepartmentsAtLocation(String locationId) {
        String sql = """
                SELECT DISTINCT um.department
                FROM usermaster um
                JOIN locationmaster lm ON lm.descriptiveName = um.worklocation
                WHERE lm.LocationId = :locationId
                ORDER BY um.department
                """;
        return jdbc.queryForList(sql, new MapSqlParameterSource("locationId", locationId), String.class);
    }

    /**
     * Finds a single employee by ID in usermaster (used to denormalise personName + department).
     */
    public Optional<PersonToMeetDto> findPersonById(String employeeId) {
        String sql = """
                SELECT employeeid, fullName, phone, department, designation
                FROM usermaster
                WHERE employeeid = :employeeId
                """;
        List<PersonToMeetDto> rows = jdbc.query(sql,
                new MapSqlParameterSource("employeeId", employeeId),
                (rs, rowNum) -> PersonToMeetDto.builder()
                        .id(rs.getString("employeeid"))
                        .name(rs.getString("fullName"))
                        .phone(rs.getString("phone"))
                        .department(rs.getString("department"))
                        .designation(rs.getString("designation"))
                        .build()
        );
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private Visitor mapVisitorRow(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
        return Visitor.builder()
                .visitorId(rs.getString("visitorId"))
                .visitType(VisitType.valueOf(rs.getString("visitType")))
                .entryType(rs.getString("entryType"))
                .name(rs.getString("name"))
                .mobile(rs.getString("mobile"))
                .empId(rs.getString("empId"))
                .status(VisitStatus.valueOf(rs.getString("status")))
                .personToMeet(rs.getString("personToMeet"))
                .personName(rs.getString("personName"))
                .department(rs.getString("department"))
                .locationId(rs.getString("locationId"))
                .cardNumber(rs.getObject("cardNumber", Integer.class))
                .checkInTime(rs.getTimestamp("checkInTime") != null
                        ? rs.getTimestamp("checkInTime").toLocalDateTime() : null)
                .checkOutTime(rs.getTimestamp("checkOutTime") != null
                        ? rs.getTimestamp("checkOutTime").toLocalDateTime() : null)
                .reasonForVisit(rs.getString("reasonForVisit"))
                .createdBy(rs.getString("createdBy"))
                .build();
    }
}
