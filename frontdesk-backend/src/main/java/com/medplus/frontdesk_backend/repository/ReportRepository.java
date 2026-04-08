package com.medplus.frontdesk_backend.repository;

import com.medplus.frontdesk_backend.dto.ReportAvgDurationDto;
import com.medplus.frontdesk_backend.dto.ReportDeptSummaryDto;
import com.medplus.frontdesk_backend.dto.ReportFrequentVisitorDto;
import com.medplus.frontdesk_backend.dto.ReportRatioDto;
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
            LocalDate from, LocalDate to, String locationId) {

        String sql = """
                SELECT   department,
                         COUNT(*) AS visitCount
                FROM     visitorlog
                WHERE    DATE(checkInTime) BETWEEN :from AND :to
                  AND    (:locationId IS NULL OR locationId = :locationId)
                GROUP BY department
                ORDER BY visitCount DESC
                """;

        return jdbc.query(sql, params(from, to, locationId),
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
            LocalDate from, LocalDate to, String locationId) {

        String sql = """
                SELECT SUM(CASE WHEN entryType = 'VISITOR'  THEN 1 ELSE 0 END) AS visitorCount,
                       SUM(CASE WHEN entryType = 'EMPLOYEE' THEN 1 ELSE 0 END) AS employeeCount,
                       COUNT(*)                                                 AS totalCount
                FROM   visitorlog
                WHERE  DATE(checkInTime) BETWEEN :from AND :to
                  AND  (:locationId IS NULL OR locationId = :locationId)
                """;

        ReportRatioDto result = jdbc.queryForObject(sql, params(from, to, locationId),
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
            LocalDate from, LocalDate to, String locationId) {

        String sql = """
                SELECT   department,
                         AVG(TIMESTAMPDIFF(MINUTE, checkInTime, checkOutTime)) AS avgDurationMinutes,
                         COUNT(*)                                               AS visitCount
                FROM     visitorlog
                WHERE    checkOutTime IS NOT NULL
                  AND    DATE(checkInTime) BETWEEN :from AND :to
                  AND    (:locationId IS NULL OR locationId = :locationId)
                GROUP BY department
                ORDER BY avgDurationMinutes DESC
                """;

        return jdbc.query(sql, params(from, to, locationId),
                (rs, rowNum) -> ReportAvgDurationDto.builder()
                        .department(rs.getString("department"))
                        .avgDurationMinutes(rs.getDouble("avgDurationMinutes"))
                        .visitCount(rs.getLong("visitCount"))
                        .build());
    }

    // ── Frequent Visitor Report ───────────────────────────────────────────────

    /**
     * Returns visitors (entryType = VISITOR) who have checked in at least
     * {@code minVisits} times within the date range, ordered by visit count desc.
     * Capped at 50 rows.
     *
     * @param minVisits minimum number of check-ins to qualify (default 2)
     */
    public List<ReportFrequentVisitorDto> findFrequentVisitors(
            LocalDate from, LocalDate to, String locationId, int minVisits) {

        String sql = """
                SELECT   name,
                         mobile,
                         COUNT(*)                                              AS visitCount,
                         DATE_FORMAT(MAX(checkInTime), '%Y-%m-%dT%H:%i:%s')   AS lastVisit,
                         GROUP_CONCAT(DISTINCT department
                                      ORDER BY department
                                      SEPARATOR ', ')                         AS departments
                FROM     visitorlog
                WHERE    entryType = 'VISITOR'
                  AND    DATE(checkInTime) BETWEEN :from AND :to
                  AND    (:locationId IS NULL OR locationId = :locationId)
                GROUP BY name, mobile
                HAVING   COUNT(*) >= :minVisits
                ORDER BY visitCount DESC, MAX(checkInTime) DESC
                LIMIT    50
                """;

        MapSqlParameterSource p = params(from, to, locationId)
                .addValue("minVisits", minVisits);

        return jdbc.query(sql, p,
                (rs, rowNum) -> ReportFrequentVisitorDto.builder()
                        .name(rs.getString("name"))
                        .mobile(rs.getString("mobile"))
                        .visitCount(rs.getLong("visitCount"))
                        .lastVisit(rs.getString("lastVisit"))
                        .departments(rs.getString("departments"))
                        .build());
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private MapSqlParameterSource params(LocalDate from, LocalDate to, String locationId) {
        return new MapSqlParameterSource()
                .addValue("from",       from)
                .addValue("to",         to)
                .addValue("locationId", locationId);
    }
}
