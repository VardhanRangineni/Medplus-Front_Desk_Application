package com.medplus.frontdesk_backend.repository;

import com.medplus.frontdesk_backend.dto.VisitReasonDto;
import com.medplus.frontdesk_backend.model.VisitReasonType;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;
import org.springframework.util.StringUtils;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class VisitReasonRepository {

    private final NamedParameterJdbcTemplate jdbc;

    private static final String SELECT_ALL = """
            SELECT id, `type`, reasonName, status, createdBy, createdAt, modifiedAt
            FROM visit_reasons
            """;

    /**
     * Return all visit reasons, optionally filtered by type and status.
     */
    public List<VisitReasonDto> findAll(VisitReasonType type, String status, int offset, int limit) {
        var params = new MapSqlParameterSource()
                .addValue("offset", offset)
                .addValue("limit", limit);

        StringBuilder sql = new StringBuilder(SELECT_ALL);
        StringBuilder where = new StringBuilder(" WHERE 1=1");

        if (type != null) {
            where.append(" AND `type` = :type");
            params.addValue("type", type.name());
        }
        if (StringUtils.hasText(status)) {
            where.append(" AND status = :status");
            params.addValue("status", status.trim().toUpperCase());
        }

        sql.append(where)
           .append(" ORDER BY `type`, reasonName LIMIT :offset, :limit");

        return jdbc.query(sql.toString(), params, this::mapRow);
    }

    /**
     * Count all visit reasons, optionally filtered by type and status.
     */
    public long countAll(VisitReasonType type, String status) {
        var params = new MapSqlParameterSource();
        StringBuilder where = new StringBuilder(" WHERE 1=1");

        if (type != null) {
            where.append(" AND `type` = :type");
            params.addValue("type", type.name());
        }
        if (StringUtils.hasText(status)) {
            where.append(" AND status = :status");
            params.addValue("status", status.trim().toUpperCase());
        }

        String sql = "SELECT COUNT(*) FROM visit_reasons " + where;
        Long count = jdbc.queryForObject(sql, params, Long.class);
        return count != null ? count : 0;
    }

    /**
     * Return only active reasons for a given type — used by dropdown consumers.
     */
    public List<VisitReasonDto> findActiveByType(VisitReasonType type) {
        return jdbc.query(
                SELECT_ALL + " WHERE `type` = :type AND status = 'ACTIVE' ORDER BY reasonName",
                new MapSqlParameterSource("type", type.name()),
                this::mapRow);
    }

    /**
     * Find a single visit reason by ID.
     */
    public Optional<VisitReasonDto> findById(long id) {
        List<VisitReasonDto> rows = jdbc.query(
                SELECT_ALL + " WHERE id = :id",
                new MapSqlParameterSource("id", id),
                this::mapRow);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    /**
     * Insert a new visit reason; returns the generated ID.
     */
    public long insert(VisitReasonType type, String reasonName, String createdBy) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbc.getJdbcTemplate().update(connection -> {
            var ps = connection.prepareStatement(
                    """
                    INSERT INTO visit_reasons (type, reasonName, status, createdBy)
                    VALUES (?, ?, 'ACTIVE', ?)
                    """,
                    new String[]{"id"});
            ps.setString(1, type.name());
            ps.setString(2, reasonName.trim());
            ps.setString(3, createdBy);
            return ps;
        }, keyHolder);
        Number key = keyHolder.getKey();
        if (key == null) {
            throw new IllegalStateException("Failed to obtain visit_reasons id.");
        }
        return key.longValue();
    }

    /**
     * Update the reason name for an existing visit reason.
     */
    public int updateName(long id, String reasonName, String modifiedBy) {
        return jdbc.update(
                """
                UPDATE visit_reasons
                SET reasonName = :reasonName,
                    modifiedBy = :modifiedBy
                WHERE id = :id
                """,
                new MapSqlParameterSource()
                        .addValue("id", id)
                        .addValue("reasonName", reasonName.trim())
                        .addValue("modifiedBy", modifiedBy));
    }

    /**
     * Toggle the active/inactive status of a visit reason.
     */
    public int updateStatus(long id, boolean active, String modifiedBy) {
        return jdbc.update(
                """
                UPDATE visit_reasons
                SET status = :status,
                    modifiedBy = :modifiedBy
                WHERE id = :id
                """,
                new MapSqlParameterSource()
                        .addValue("id", id)
                        .addValue("status", active ? "ACTIVE" : "INACTIVE")
                        .addValue("modifiedBy", modifiedBy));
    }

    /**
     * Delete a visit reason by ID.
     */
    public int delete(long id) {
        return jdbc.update(
                "DELETE FROM visit_reasons WHERE id = :id",
                new MapSqlParameterSource("id", id));
    }

    // ── Row mapper ────────────────────────────────────────────────────────────

    private VisitReasonDto mapRow(ResultSet rs, int rowNum) throws SQLException {
        return VisitReasonDto.builder()
                .id(rs.getLong("id"))
                .type(VisitReasonType.valueOf(rs.getString("type")))
                .reasonName(rs.getString("reasonName"))
                .isActive("ACTIVE".equalsIgnoreCase(rs.getString("status")))
                .createdAt(toLocalDateTime(rs.getTimestamp("createdAt")))
                .modifiedAt(toLocalDateTime(rs.getTimestamp("modifiedAt")))
                .build();
    }

    private static LocalDateTime toLocalDateTime(Timestamp ts) {
        return ts != null ? ts.toLocalDateTime() : null;
    }
}
