package com.medplus.frontdesk_backend.repository;

import com.medplus.frontdesk_backend.dto.ReportAvgDurationDto;
import com.medplus.frontdesk_backend.dto.ReportDeptSummaryDto;
import com.medplus.frontdesk_backend.dto.ReportFrequentVisitorDto;
import com.medplus.frontdesk_backend.dto.ReportRatioDto;
import com.medplus.frontdesk_backend.dto.ReportReceptionistEntryDto;
import com.medplus.frontdesk_backend.dto.StaffActivityFilterDto;
import com.medplus.frontdesk_backend.dto.ReportVisitTrendPointDto;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

/**
 * JDBC-backed read-only repository for report aggregations.
 *
 * All queries accept an optional {@code locationId} parameter.
 * When {@code locationId} is {@code null} (admin scope), the WHERE clause
 * skips the location filter so results span all locations.
 */
@Repository
@RequiredArgsConstructor
public class ReportRepository {

    private final NamedParameterJdbcTemplate jdbc;

    // ── Department-wise Visit Summary ─────────────────────────────────────────

    /**
     * Returns visit counts grouped by department, ordered highest first.
     *
     * @param from       inclusive start date (check-in date)
     * @param to         inclusive end date   (check-in date)
     * @param locationId scope to a single location, or {@code null} for all
     */
    public List<ReportDeptSummaryDto> findDeptSummary(
            LocalDate from, LocalDate to, String locationId, String department) {

        String sql = """
                SELECT   department,
                         COUNT(*) AS visitCount
                FROM     visitorlog
                WHERE    DATE(checkInTime) BETWEEN :from AND :to
                  AND    (:locationId IS NULL OR locationId = :locationId)
                  AND    (:department IS NULL OR department = :department)
                GROUP BY department
                ORDER BY visitCount DESC
                """;

        return jdbc.query(sql, params(from, to, locationId, department),
                (rs, rowNum) -> ReportDeptSummaryDto.builder()
                        .department(rs.getString("department"))
                        .visitCount(rs.getLong("visitCount"))
                        .build());
    }

    // ── Visitor vs Employee Ratio ─────────────────────────────────────────────

    /**
     * Returns aggregated visitor / employee entry counts for the date range.
     */
    public ReportRatioDto findVisitorRatio(
            LocalDate from, LocalDate to, String locationId, String department) {

        String sql = """
                SELECT SUM(CASE WHEN entryType = 'VISITOR'  THEN 1 ELSE 0 END) AS visitorCount,
                       SUM(CASE WHEN entryType = 'EMPLOYEE' THEN 1 ELSE 0 END) AS employeeCount,
                       COUNT(*)                                                 AS totalCount
                FROM   visitorlog
                WHERE  DATE(checkInTime) BETWEEN :from AND :to
                  AND  (:locationId IS NULL OR locationId = :locationId)
                  AND  (:department IS NULL OR department = :department)
                """;

        ReportRatioDto result = jdbc.queryForObject(sql, params(from, to, locationId, department),
                (rs, rowNum) -> ReportRatioDto.builder()
                        .visitorCount(rs.getLong("visitorCount"))
                        .employeeCount(rs.getLong("employeeCount"))
                        .totalCount(rs.getLong("totalCount"))
                        .build());

        return result != null ? result : new ReportRatioDto(0, 0, 0);
    }

    // ── Average Visit Duration per Department ─────────────────────────────────

    /**
     * Returns average check-in-to-check-out duration (minutes) per department.
     * Only rows where {@code checkOutTime IS NOT NULL} contribute.
     * Ordered longest average duration first.
     */
    public List<ReportAvgDurationDto> findAvgDuration(
            LocalDate from, LocalDate to, String locationId, String department) {

        String sql = """
                SELECT   department,
                         AVG(TIMESTAMPDIFF(MINUTE, checkInTime, checkOutTime)) AS avgDurationMinutes,
                         COUNT(*)                                               AS visitCount
                FROM     visitorlog
                WHERE    checkOutTime IS NOT NULL
                  AND    DATE(checkInTime) BETWEEN :from AND :to
                  AND    (:locationId IS NULL OR locationId = :locationId)
                  AND    (:department IS NULL OR department = :department)
                GROUP BY department
                ORDER BY avgDurationMinutes DESC
                """;

        return jdbc.query(sql, params(from, to, locationId, department),
                (rs, rowNum) -> ReportAvgDurationDto.builder()
                        .department(rs.getString("department"))
                        .avgDurationMinutes(rs.getDouble("avgDurationMinutes"))
                        .visitCount(rs.getLong("visitCount"))
                        .build());
    }

    // ── Frequent / repeated visits (visitor + employee) ───────────────────────

    /**
     * People with at least {@code minVisits} check-ins in the range (VISITOR or EMPLOYEE).
     * Identity: visitors by name+mobile; employees by name+empId.
     * Capped at 50 rows.
     */
    public List<ReportFrequentVisitorDto> findFrequentVisitors(
            LocalDate from, LocalDate to, String locationId, int minVisits, String department) {

        String sql = """
                SELECT   entryType,
                         name,
                         MAX(mobile)                                           AS mobile,
                         MAX(empId)                                            AS empId,
                         COUNT(*)                                              AS visitCount,
                         DATE_FORMAT(MAX(checkInTime), '%Y-%m-%dT%H:%i:%s')   AS lastVisit,
                         GROUP_CONCAT(DISTINCT department
                                      ORDER BY department
                                      SEPARATOR ', ')                         AS departments
                FROM     visitorlog
                WHERE    DATE(checkInTime) BETWEEN :from AND :to
                  AND    (:locationId IS NULL OR locationId = :locationId)
                  AND    (:department IS NULL OR department = :department)
                  AND    entryType IN ('VISITOR', 'EMPLOYEE')
                GROUP BY entryType,
                         name,
                         CASE
                           WHEN entryType = 'EMPLOYEE' THEN IFNULL(empId, '')
                           ELSE IFNULL(mobile, '')
                         END
                HAVING   COUNT(*) >= :minVisits
                ORDER BY visitCount DESC, MAX(checkInTime) DESC
                LIMIT    50
                """;

        MapSqlParameterSource p = params(from, to, locationId, department)
                .addValue("minVisits", minVisits);

        return jdbc.query(sql, p,
                (rs, rowNum) -> ReportFrequentVisitorDto.builder()
                        .entryType(rs.getString("entryType"))
                        .name(rs.getString("name"))
                        .mobile(rs.getString("mobile"))
                        .empId(rs.getString("empId"))
                        .visitCount(rs.getLong("visitCount"))
                        .lastVisit(rs.getString("lastVisit"))
                        .departments(rs.getString("departments"))
                        .build());
    }

    // ── Visit trend by hour of day ────────────────────────────────────────────

    public List<ReportVisitTrendPointDto> findVisitTrendByHour(
            LocalDate from, LocalDate to, String locationId, String department) {

        String sql = """
                SELECT   HOUR(checkInTime) AS hourOfDay,
                         COUNT(*)          AS visitCount
                FROM     visitorlog
                WHERE    DATE(checkInTime) BETWEEN :from AND :to
                  AND    (:locationId IS NULL OR locationId = :locationId)
                  AND    (:department IS NULL OR department = :department)
                GROUP BY HOUR(checkInTime)
                ORDER BY hourOfDay
                """;

        var rows = jdbc.query(sql, params(from, to, locationId, department),
                (rs, rowNum) -> new int[] {
                        rs.getInt("hourOfDay"),
                        rs.getInt("visitCount")
                });

        long[] countsByHour = new long[24];
        for (int[] row : rows) {
            int h = row[0];
            if (h >= 0 && h < 24) countsByHour[h] = row[1];
        }

        java.util.List<ReportVisitTrendPointDto> points = new java.util.ArrayList<>(24);
        for (int h = 0; h < 24; h++) {
            points.add(ReportVisitTrendPointDto.builder()
                    .label(formatHourLabel(h))
                    .count(countsByHour[h])
                    .build());
        }
        return points;
    }

    /** Visitors currently checked in (today, still inside). */
    public long findActiveVisitorsNow(String locationId, String department) {
        String sql = """
                SELECT COUNT(*)
                FROM   visitorlog
                WHERE  status = 'CHECKED_IN'
                  AND  DATE(checkInTime) = CURDATE()
                  AND  (:locationId IS NULL OR locationId = :locationId)
                  AND  (:department IS NULL OR department = :department)
                """;
        Long n = jdbc.queryForObject(sql,
                new MapSqlParameterSource()
                        .addValue("locationId", locationId)
                        .addValue("department", blankToNull(department)),
                Long.class);
        return n == null ? 0L : n;
    }

    private static String formatHourLabel(int hour) {
        if (hour == 0)  return "12 AM";
        if (hour < 12)   return hour + " AM";
        if (hour == 12)  return "12 PM";
        return (hour - 12) + " PM";
    }

    // ── Receptionist Activity ─────────────────────────────────────────────────

    public List<ReportReceptionistEntryDto> findStaffActivityPaged(
            LocalDate from, LocalDate to, String locationId, String supervisorEmployerId,
            StaffActivityFilterDto filters, int offset, int limit) {

        StringBuilder sql = new StringBuilder("""
                SELECT v.visitorId,
                       v.createdBy,
                       IFNULL(u.fullName, v.createdBy)               AS receptionistName,
                       v.name                                          AS visitorName,
                       v.mobile,
                       v.empId,
                       v.entryType,
                       v.department,
                       v.personName                                    AS personToMeet,
                       v.locationId,
                       v.cardNumber,
                       v.companyName,
                       v.workstationMac,
                       v.modifiedBy,
                       DATE_FORMAT(v.checkInTime,  '%Y-%m-%dT%H:%i:%s') AS ciTime,
                       DATE_FORMAT(v.checkOutTime, '%Y-%m-%dT%H:%i:%s') AS coTime,
                       v.status                                        AS entryStatus
                FROM   visitorlog v
                LEFT JOIN usermanagement u ON LOWER(u.employeeid) = LOWER(v.createdBy)
                WHERE  DATE(v.checkInTime) BETWEEN :from AND :to
                  AND  (:locationId IS NULL OR v.locationId = :locationId)
                """);

        MapSqlParameterSource p = params(from, to, locationId);
        appendStaffActivityFilters(sql, p, filters, supervisorEmployerId);
        sql.append("ORDER BY v.checkInTime DESC\nLIMIT :limit OFFSET :offset");
        p.addValue("limit", limit).addValue("offset", offset);

        return jdbc.query(sql.toString(), p, this::mapStaffActivityRow);
    }

    public long countStaffActivity(
            LocalDate from, LocalDate to, String locationId, String supervisorEmployerId,
            StaffActivityFilterDto filters) {

        StringBuilder sql = new StringBuilder("""
                SELECT COUNT(*)
                FROM   visitorlog v
                LEFT JOIN usermanagement u ON LOWER(u.employeeid) = LOWER(v.createdBy)
                WHERE  DATE(v.checkInTime) BETWEEN :from AND :to
                  AND  (:locationId IS NULL OR v.locationId = :locationId)
                """);

        MapSqlParameterSource p = params(from, to, locationId);
        appendStaffActivityFilters(sql, p, filters, supervisorEmployerId);

        Long count = jdbc.queryForObject(sql.toString(), p, Long.class);
        return count == null ? 0L : count;
    }

    private void appendStaffActivityFilters(
            StringBuilder sql, MapSqlParameterSource p,
            StaffActivityFilterDto filters, String supervisorEmployerId) {

        p.addValue("supervisorEmployerId",
                supervisorEmployerId != null && !supervisorEmployerId.isBlank()
                        ? supervisorEmployerId.trim() : null);
        sql.append("""
                  AND (
                         :supervisorEmployerId IS NULL
                      OR LOWER(IFNULL(u.createdBy,'')) = LOWER(:supervisorEmployerId)
                  )
                """);

        if (filters.getStaffQuery() != null && !filters.getStaffQuery().isBlank()) {
            sql.append("""
                  AND (
                         LOWER(IFNULL(v.createdBy,'')) LIKE :staffQ
                      OR LOWER(IFNULL(u.fullName,''))  LIKE :staffQ
                  )
                """);
            p.addValue("staffQ", like(filters.getStaffQuery()));
        }
        if (filters.getVisitorName() != null && !filters.getVisitorName().isBlank()) {
            sql.append("  AND LOWER(IFNULL(v.name,'')) LIKE :visitorName\n");
            p.addValue("visitorName", like(filters.getVisitorName()));
        }
        if (filters.getContactQuery() != null && !filters.getContactQuery().isBlank()) {
            sql.append("""
                  AND (
                         LOWER(IFNULL(v.mobile,'')) LIKE :contactQuery
                      OR LOWER(IFNULL(v.empId,''))  LIKE :contactQuery
                  )
                """);
            p.addValue("contactQuery", like(filters.getContactQuery()));
        }
        if (filters.getEntryType() != null && !filters.getEntryType().isBlank()) {
            sql.append("  AND v.entryType = :entryType\n");
            p.addValue("entryType", filters.getEntryType().trim().toUpperCase());
        }
        if (filters.getDepartment() != null && !filters.getDepartment().isBlank()) {
            sql.append("  AND LOWER(IFNULL(v.department,'')) LIKE :department\n");
            p.addValue("department", like(filters.getDepartment()));
        }
        if (filters.getPersonToMeet() != null && !filters.getPersonToMeet().isBlank()) {
            sql.append("  AND LOWER(IFNULL(v.personName,'')) LIKE :personToMeet\n");
            p.addValue("personToMeet", like(filters.getPersonToMeet()));
        }
        if (filters.getStatus() != null && !filters.getStatus().isBlank()) {
            String st = filters.getStatus().trim().toLowerCase();
            String dbStatus = switch (st) {
                case "checked-in", "checked_in" -> "CHECKED_IN";
                case "checked-out", "checked_out" -> "CHECKED_OUT";
                default -> filters.getStatus().trim().toUpperCase();
            };
            sql.append("  AND v.status = :status\n");
            p.addValue("status", dbStatus);
        }
        if (filters.getCardNumber() != null && !filters.getCardNumber().isBlank()) {
            sql.append("  AND CAST(IFNULL(v.cardNumber, '') AS CHAR) LIKE :cardNumber\n");
            p.addValue("cardNumber", "%" + filters.getCardNumber().trim() + "%");
        }
        if (filters.getWorkstationMac() != null && !filters.getWorkstationMac().isBlank()) {
            String macNorm = filters.getWorkstationMac().trim().toLowerCase()
                    .replace(":", "").replace("-", "");
            sql.append("""
                  AND LOWER(REPLACE(REPLACE(IFNULL(v.workstationMac,''), ':', ''), '-', ''))
                      LIKE :workstationMac
                """);
            p.addValue("workstationMac", "%" + macNorm + "%");
        }
    }

    private static String like(String raw) {
        return "%" + raw.trim().toLowerCase() + "%";
    }

    private ReportReceptionistEntryDto mapStaffActivityRow(java.sql.ResultSet rs, int rowNum)
            throws java.sql.SQLException {
        return ReportReceptionistEntryDto.builder()
                .visitorId(rs.getString("visitorId"))
                .createdBy(rs.getString("createdBy"))
                .receptionistName(rs.getString("receptionistName"))
                .visitorName(rs.getString("visitorName"))
                .mobile(rs.getString("mobile"))
                .empId(rs.getString("empId"))
                .entryType(rs.getString("entryType"))
                .department(rs.getString("department"))
                .personToMeet(rs.getString("personToMeet"))
                .locationId(rs.getString("locationId"))
                .cardNumber(rs.getObject("cardNumber", Integer.class))
                .companyName(rs.getString("companyName"))
                .workstationMac(rs.getString("workstationMac"))
                .modifiedBy(rs.getString("modifiedBy"))
                .checkInTime(rs.getString("ciTime"))
                .checkOutTime(rs.getString("coTime"))
                .status(rs.getString("entryStatus"))
                .build();
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private MapSqlParameterSource params(LocalDate from, LocalDate to, String locationId) {
        return params(from, to, locationId, null);
    }

    private MapSqlParameterSource params(LocalDate from, LocalDate to, String locationId, String department) {
        return new MapSqlParameterSource()
                .addValue("from",       from)
                .addValue("to",         to)
                .addValue("locationId", locationId)
                .addValue("department", blankToNull(department));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
