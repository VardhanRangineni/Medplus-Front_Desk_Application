package com.medplus.frontdesk.backend.repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import com.medplus.frontdesk.backend.dto.dashboard.DashboardFlowPointDto;
import com.medplus.frontdesk.backend.dto.dashboard.DashboardKpiDto;
import com.medplus.frontdesk.backend.dto.dashboard.LocationOptionDto;
import com.medplus.frontdesk.backend.dto.dashboard.RecentVisitorDto;

@Repository
public class JdbcDashboardRepository implements DashboardRepository {

    private static final String TYPE_ALL          = "ALL";
    private static final String TYPE_EMPLOYEE     = "EMPLOYEE";
    private static final String TYPE_NON_EMPLOYEE = "NONEMPLOYEE";

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public JdbcDashboardRepository(
            @Qualifier("medplusNamedParameterJdbcTemplate") NamedParameterJdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    // ── KPIs ────────────────────────────────────────────────────────────────

    /**
     * Returns all nine KPI values using only 3 SQL queries (down from 9).
     * Each query uses conditional SUM/CASE to retrieve all three breakdowns
     * (ALL / EMPLOYEE / NONEMPLOYEE) in a single round-trip.
     *
     * Check-in / check-out counts are scoped to the given date window.
     * "Active in building" is a live count (status = CheckedIn) with no
     * date-window restriction so it reflects the real current state.
     */
    @Override
    public DashboardKpiDto fetchKpis(LocalDateTime start, LocalDateTime end, String locationId) {

        // Query 1: check-in counts (grouped by visitorType in one pass)
        StringBuilder ciSql = new StringBuilder("""
                SELECT COUNT(*)                                                        AS total,
                       SUM(CASE WHEN v.visitorType = 'EMPLOYEE'    THEN 1 ELSE 0 END) AS empCount,
                       SUM(CASE WHEN v.visitorType = 'NONEMPLOYEE' THEN 1 ELSE 0 END) AS nonEmpCount
                FROM `Visitor` v
                WHERE v.checkInTime >= :start
                  AND v.checkInTime < :end
                """);
        MapSqlParameterSource ciParams = baseParams(start, end);
        if (locationId != null && !locationId.isBlank()) {
            ciSql.append(" AND v.locationId = :locationId");
            ciParams.addValue("locationId", locationId);
        }
        int[] ci = jdbcTemplate.queryForObject(ciSql.toString(), ciParams,
                (rs, r) -> new int[]{ rs.getInt("total"), rs.getInt("empCount"), rs.getInt("nonEmpCount") });

        // Query 2: check-out counts (by checkOutTime in window)
        StringBuilder coSql = new StringBuilder("""
                SELECT COUNT(*)                                                        AS total,
                       SUM(CASE WHEN v.visitorType = 'EMPLOYEE'    THEN 1 ELSE 0 END) AS empCount,
                       SUM(CASE WHEN v.visitorType = 'NONEMPLOYEE' THEN 1 ELSE 0 END) AS nonEmpCount
                FROM `Visitor` v
                WHERE v.checkOutTime >= :start
                  AND v.checkOutTime < :end
                  AND v.status = 'CheckedOut'
                """);
        MapSqlParameterSource coParams = baseParams(start, end);
        if (locationId != null && !locationId.isBlank()) {
            coSql.append(" AND v.locationId = :locationId");
            coParams.addValue("locationId", locationId);
        }
        int[] co = jdbcTemplate.queryForObject(coSql.toString(), coParams,
                (rs, r) -> new int[]{ rs.getInt("total"), rs.getInt("empCount"), rs.getInt("nonEmpCount") });

        // Query 3: currently active (live, no date window)
        StringBuilder activeSql = new StringBuilder("""
                SELECT COUNT(*)                                                        AS total,
                       SUM(CASE WHEN v.visitorType = 'EMPLOYEE'    THEN 1 ELSE 0 END) AS empCount,
                       SUM(CASE WHEN v.visitorType = 'NONEMPLOYEE' THEN 1 ELSE 0 END) AS nonEmpCount
                FROM `Visitor` v
                WHERE v.status = 'CheckedIn'
                """);
        MapSqlParameterSource activeParams = new MapSqlParameterSource();
        if (locationId != null && !locationId.isBlank()) {
            activeSql.append(" AND v.locationId = :locationId");
            activeParams.addValue("locationId", locationId);
        }
        int[] active = jdbcTemplate.queryForObject(activeSql.toString(), activeParams,
                (rs, r) -> new int[]{ rs.getInt("total"), rs.getInt("empCount"), rs.getInt("nonEmpCount") });

        return new DashboardKpiDto(
                ci[0],     ci[1],     ci[2],
                co[0],     co[1],     co[2],
                active[0], active[1], active[2]);
    }

    // ── Visitor Flow ─────────────────────────────────────────────────────────

    @Override
    public List<DashboardFlowPointDto> fetchVisitorFlow(
            LocalDateTime start,
            LocalDateTime end,
            String locationId,
            String visitorType) {

        StringBuilder sql = new StringBuilder("""
                SELECT HOUR(v.checkInTime) AS hourNum,
                       COUNT(*)            AS cnt
                FROM `Visitor` v
                WHERE v.checkInTime >= :start
                  AND v.checkInTime < :end
                """);

        MapSqlParameterSource params = baseParams(start, end);
        appendLocationAndTypeFilters(sql, params, locationId, normalizeVisitorType(visitorType), "v");
        sql.append("""
                
                GROUP BY HOUR(v.checkInTime)
                ORDER BY HOUR(v.checkInTime)
                """);

        return jdbcTemplate.query(sql.toString(), params, flowPointRowMapper());
    }

    // ── Recent Visitors ──────────────────────────────────────────────────────

    @Override
    public List<RecentVisitorDto> fetchRecentVisitors(
            LocalDateTime start,
            LocalDateTime end,
            String locationId,
            String visitorType,
            int limit) {

        int safeLimit = Math.max(1, Math.min(limit, 25));

        StringBuilder sql = new StringBuilder("""
                SELECT v.visitorId,
                       v.visitorType,
                       v.fullName,
                       v.identificationNumber,
                       v.govtId,
                       v.locationId,
                       l.descriptiveName AS locationName,
                       v.status,
                       v.personToMeet,
                       v.cardNumber,
                       v.checkInTime,
                       v.checkOutTime
                FROM `Visitor` v
                LEFT JOIN `Locations` l ON l.LocationId = v.locationId
                WHERE v.checkInTime >= :start
                  AND v.checkInTime < :end
                """);

        MapSqlParameterSource params = baseParams(start, end);
        appendLocationAndTypeFilters(sql, params, locationId, normalizeVisitorType(visitorType), "v");
        sql.append("\nORDER BY v.checkInTime DESC\nLIMIT ").append(safeLimit);

        return jdbcTemplate.query(sql.toString(), params, recentVisitorRowMapper());
    }

    // ── Paginated table query ─────────────────────────────────────────────────

    @Override
    public List<RecentVisitorDto> fetchVisitorsPaged(
            LocalDateTime start,
            LocalDateTime end,
            String locationId,
            String visitorType,
            String status,
            String search,
            int offset,
            int limit) {

        int safeLimit  = Math.max(1, Math.min(limit, 50));
        int safeOffset = Math.max(0, offset);

        StringBuilder sql = new StringBuilder("""
                SELECT v.visitorId,
                       v.visitorType,
                       v.fullName,
                       v.identificationNumber,
                       v.govtId,
                       v.locationId,
                       l.descriptiveName AS locationName,
                       v.status,
                       v.personToMeet,
                       v.cardNumber,
                       v.checkInTime,
                       v.checkOutTime
                FROM `Visitor` v
                LEFT JOIN `Locations` l ON l.LocationId = v.locationId
                WHERE v.checkInTime >= :start
                  AND v.checkInTime < :end
                """);

        MapSqlParameterSource params = baseParams(start, end);
        appendTableFilters(sql, params, locationId, visitorType, status, search, "v");
        sql.append("\nORDER BY v.checkInTime DESC")
           .append("\nLIMIT :limit OFFSET :offset");
        params.addValue("limit", safeLimit).addValue("offset", safeOffset);

        return jdbcTemplate.query(sql.toString(), params, recentVisitorRowMapper());
    }

    @Override
    public int countVisitorsTotal(
            LocalDateTime start,
            LocalDateTime end,
            String locationId,
            String visitorType,
            String status,
            String search) {

        StringBuilder sql = new StringBuilder("""
                SELECT COUNT(*)
                FROM `Visitor` v
                WHERE v.checkInTime >= :start
                  AND v.checkInTime < :end
                """);

        MapSqlParameterSource params = baseParams(start, end);
        appendTableFilters(sql, params, locationId, visitorType, status, search, "v");

        Integer count = jdbcTemplate.queryForObject(sql.toString(), params, Integer.class);
        return count == null ? 0 : count;
    }

    // ── Locations ────────────────────────────────────────────────────────────

    @Override
    public List<LocationOptionDto> fetchLocations() {
        String sql = """
                SELECT LocationId,
                       descriptiveName,
                       type,
                       city,
                       state,
                       status
                FROM `Locations`
                ORDER BY descriptiveName
                """;
        return jdbcTemplate.query(sql, locationRowMapper());
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private void appendLocationAndTypeFilters(
            StringBuilder sql,
            MapSqlParameterSource params,
            String locationId,
            String visitorType,
            String alias) {

        if (locationId != null && !locationId.isBlank()) {
            sql.append(" AND ").append(alias).append(".locationId = :locationId");
            params.addValue("locationId", locationId);
        }

        if (visitorType != null && !TYPE_ALL.equalsIgnoreCase(visitorType)) {
            sql.append(" AND ").append(alias).append(".visitorType = :visitorType");
            params.addValue("visitorType", visitorType);
        }
    }

    /**
     * Extends a WHERE clause with all four table-specific filters:
     * location, visitorType, status, and free-text search.
     */
    private void appendTableFilters(
            StringBuilder sql,
            MapSqlParameterSource params,
            String locationId,
            String visitorType,
            String status,
            String search,
            String alias) {

        appendLocationAndTypeFilters(sql, params, locationId, normalizeVisitorType(visitorType), alias);

        if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
            sql.append(" AND ").append(alias).append(".status = :status");
            params.addValue("status", status);
        }

        if (search != null && !search.isBlank()) {
            sql.append(" AND (")
               .append(alias).append(".fullName LIKE :search OR ")
               .append(alias).append(".identificationNumber LIKE :search)");
            params.addValue("search", "%" + search.trim() + "%");
        }
    }

    private MapSqlParameterSource baseParams(LocalDateTime start, LocalDateTime end) {
        return new MapSqlParameterSource()
                .addValue("start", start)
                .addValue("end", end);
    }

    private String normalizeVisitorType(String visitorType) {
        if (visitorType == null || visitorType.isBlank()) return TYPE_ALL;
        String v = visitorType.trim().toUpperCase();
        return TYPE_EMPLOYEE.equals(v) || TYPE_NON_EMPLOYEE.equals(v) ? v : TYPE_ALL;
    }

    // ── Row mappers ──────────────────────────────────────────────────────────

    /**
     * Converts a raw hour integer (0-23) into the label the frontend expects:
     * 0 → "12am", 1 → "1am", 12 → "12pm", 13 → "1pm", etc.
     */
    private RowMapper<DashboardFlowPointDto> flowPointRowMapper() {
        return (rs, rowNum) -> {
            int hour = rs.getInt("hourNum");
            String label;
            if (hour == 0) {
                label = "12am";
            } else if (hour < 12) {
                label = hour + "am";
            } else if (hour == 12) {
                label = "12pm";
            } else {
                label = (hour - 12) + "pm";
            }
            return new DashboardFlowPointDto(label, rs.getInt("cnt"));
        };
    }

    private RowMapper<LocationOptionDto> locationRowMapper() {
        return (rs, rowNum) -> new LocationOptionDto(
                rs.getString("LocationId"),
                rs.getString("descriptiveName"),
                rs.getString("type"),
                rs.getString("city"),
                rs.getString("state"),
                rs.getString("status"));
    }

    private RowMapper<RecentVisitorDto> recentVisitorRowMapper() {
        return (rs, rowNum) -> new RecentVisitorDto(
                rs.getString("visitorId"),
                rs.getString("visitorType"),
                rs.getString("fullName"),
                rs.getString("identificationNumber"),
                rs.getString("govtId"),
                rs.getString("locationId"),
                rs.getString("locationName"),
                rs.getString("status"),
                rs.getString("personToMeet"),
                rs.getString("cardNumber"),
                getLocalDateTime(rs, "checkInTime"),
                getLocalDateTime(rs, "checkOutTime"));
    }

    private LocalDateTime getLocalDateTime(ResultSet rs, String column) throws SQLException {
        var ts = rs.getTimestamp(column);
        return ts == null ? null : ts.toLocalDateTime();
    }
}
