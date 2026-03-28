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

import com.medplus.frontdesk.backend.dto.visitor.CheckInVisitorDto;
import com.medplus.frontdesk.backend.dto.visitor.UpdateVisitorDto;
import com.medplus.frontdesk.backend.dto.visitor.VisitorDto;

@Repository
public class JdbcVisitorRepository implements VisitorRepository {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public JdbcVisitorRepository(
            @Qualifier("medplusNamedParameterJdbcTemplate") NamedParameterJdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    // ── Write ─────────────────────────────────────────────────────────────────

    @Override
    public void insert(String createdBy, String visitorId, String groupHeadVisitorId,
                       CheckInVisitorDto dto) {
        String sql = """
                INSERT INTO `Visitor`
                    (visitorId, visitorType, fullName, locationId,
                     identificationNumber, govtId, groupHeadVisitorId,
                     status, personToMeet, cardNumber,
                     checkInTime, checkOutTime,
                     createdBy, modifiedBy, createdAt, modifiedAt)
                VALUES
                    (:visitorId, :visitorType, :fullName, :locationId,
                     :identificationNumber, :govtId, :groupHeadVisitorId,
                     'CheckedIn', :personToMeet, :cardNumber,
                     NOW(), NULL,
                     :createdBy, :createdBy, NOW(), NOW())
                """;

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("visitorId",            visitorId)
                .addValue("visitorType",           dto.getVisitorType())
                .addValue("fullName",              dto.getFullName())
                .addValue("locationId",            dto.getLocationId())
                .addValue("identificationNumber",  dto.getIdentificationNumber())
                .addValue("govtId",                dto.getGovtId())
                .addValue("groupHeadVisitorId",    groupHeadVisitorId)
                .addValue("personToMeet",          dto.getPersonToMeet())
                .addValue("cardNumber",            dto.getCardNumber())
                .addValue("createdBy",             createdBy);

        jdbcTemplate.update(sql, params);
    }

    @Override
    public boolean update(String visitorId, String modifiedBy, UpdateVisitorDto dto) {
        String sql = """
                UPDATE `Visitor`
                SET visitorType          = :visitorType,
                    fullName             = :fullName,
                    locationId           = :locationId,
                    identificationNumber = :identificationNumber,
                    govtId               = :govtId,
                    personToMeet         = :personToMeet,
                    cardNumber           = :cardNumber,
                    modifiedBy           = :modifiedBy,
                    modifiedAt           = NOW()
                WHERE visitorId = :visitorId
                """;

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("visitorId",            visitorId)
                .addValue("visitorType",           dto.getVisitorType())
                .addValue("fullName",              dto.getFullName())
                .addValue("locationId",            dto.getLocationId())
                .addValue("identificationNumber",  dto.getIdentificationNumber())
                .addValue("govtId",                dto.getGovtId())
                .addValue("personToMeet",          dto.getPersonToMeet())
                .addValue("cardNumber",            dto.getCardNumber())
                .addValue("modifiedBy",            modifiedBy);

        return jdbcTemplate.update(sql, params) > 0;
    }

    @Override
    public boolean checkOut(String visitorId, String modifiedBy) {
        String sql = """
                UPDATE `Visitor`
                SET status       = 'CheckedOut',
                    checkOutTime = NOW(),
                    modifiedBy   = :modifiedBy,
                    modifiedAt   = NOW()
                WHERE visitorId = :visitorId
                  AND status    = 'CheckedIn'
                """;

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("visitorId",  visitorId)
                .addValue("modifiedBy", modifiedBy);

        return jdbcTemplate.update(sql, params) > 0;
    }

    // ── Read ─────────────────────────────────────────────────────────────────

    @Override
    public VisitorDto findById(String visitorId) {
        String sql = """
                SELECT visitorId, visitorType, fullName, locationId,
                       identificationNumber, govtId, groupHeadVisitorId,
                       status, personToMeet, cardNumber,
                       checkInTime, checkOutTime, createdBy, createdAt
                FROM `Visitor`
                WHERE visitorId = :id
                """;
        List<VisitorDto> rows = jdbcTemplate.query(sql,
                new MapSqlParameterSource("id", visitorId), visitorRowMapper());
        return rows.isEmpty() ? null : rows.get(0);
    }

    @Override
    public List<VisitorDto> findAll(String search, String status, String locationId,
                                    LocalDateTime from, LocalDateTime to,
                                    int offset, int limit) {
        MapSqlParameterSource params = new MapSqlParameterSource();
        String whereClause = buildWhereClause(search, status, locationId, from, to, params);

        String sql = """
                SELECT visitorId, visitorType, fullName, locationId,
                       identificationNumber, govtId, groupHeadVisitorId,
                       status, personToMeet, cardNumber,
                       checkInTime, checkOutTime, createdBy, createdAt
                FROM `Visitor`
                """ + whereClause + """
                ORDER BY checkInTime DESC
                LIMIT :limit OFFSET :offset
                """;

        params.addValue("limit",  limit)
              .addValue("offset", offset);

        return jdbcTemplate.query(sql, params, visitorRowMapper());
    }

    @Override
    public int count(String search, String status, String locationId,
                     LocalDateTime from, LocalDateTime to) {
        MapSqlParameterSource params = new MapSqlParameterSource();
        String whereClause = buildWhereClause(search, status, locationId, from, to, params);

        String sql = "SELECT COUNT(*) FROM `Visitor` " + whereClause;
        Integer count = jdbcTemplate.queryForObject(sql, params, Integer.class);
        return count == null ? 0 : count;
    }

    @Override
    public int countByIdPrefix(String prefix) {
        String sql = "SELECT COUNT(*) FROM `Visitor` WHERE visitorId LIKE :pattern";
        Integer count = jdbcTemplate.queryForObject(sql,
                new MapSqlParameterSource("pattern", prefix + "%"), Integer.class);
        return count == null ? 0 : count;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Builds a reusable WHERE clause for list/count queries.
     * Injects bind parameters into {@code params} as a side-effect.
     * {@code from}/{@code to} narrow results to a checkInTime window (both optional).
     */
    private String buildWhereClause(String search, String status, String locationId,
                                    LocalDateTime from, LocalDateTime to,
                                    MapSqlParameterSource params) {
        StringBuilder where = new StringBuilder("WHERE 1=1 ");

        if (from != null) {
            where.append("AND checkInTime >= :from ");
            params.addValue("from", from);
        }
        if (to != null) {
            where.append("AND checkInTime < :to ");
            params.addValue("to", to);
        }

        if (search != null && !search.isBlank()) {
            String like = "%" + search.trim() + "%";
            where.append("""
                    AND (fullName             LIKE :search
                      OR identificationNumber LIKE :search
                      OR govtId              LIKE :search
                      OR cardNumber          LIKE :search
                      OR personToMeet        LIKE :search) """);
            params.addValue("search", like);
        }

        if (status != null && !status.equalsIgnoreCase("ALL") && !status.isBlank()) {
            where.append("AND status = :status ");
            params.addValue("status", status);
        }

        if (locationId != null && !locationId.isBlank()) {
            where.append("AND locationId = :locationId ");
            params.addValue("locationId", locationId);
        }

        return where.toString();
    }

    private RowMapper<VisitorDto> visitorRowMapper() {
        return (rs, rowNum) -> new VisitorDto(
                rs.getString("visitorId"),
                rs.getString("visitorType"),
                rs.getString("fullName"),
                rs.getString("locationId"),
                rs.getString("identificationNumber"),
                rs.getString("govtId"),
                rs.getString("groupHeadVisitorId"),
                rs.getString("status"),
                rs.getString("personToMeet"),
                rs.getString("cardNumber"),
                getLocalDateTime(rs, "checkInTime"),
                getLocalDateTime(rs, "checkOutTime"),
                rs.getString("createdBy"),
                getLocalDateTime(rs, "createdAt"));
    }

    private LocalDateTime getLocalDateTime(ResultSet rs, String col) throws SQLException {
        var ts = rs.getTimestamp(col);
        return ts == null ? null : ts.toLocalDateTime();
    }
}
