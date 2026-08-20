package com.medplus.frontdesk_backend.repository;

import com.medplus.frontdesk_backend.dto.KeyManagementContactDto;
import com.medplus.frontdesk_backend.dto.KeyManagementListFilterDto;
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
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class KeyManagementRepository {

    private final NamedParameterJdbcTemplate jdbc;

    private static final String SELECT = """
            SELECT k.id, k.mobile, k.displayName, k.portal_token, k.status, k.createdAt, k.modifiedAt
            FROM key_management_contacts k
            """;

    public List<KeyManagementContactDto> findContacts(KeyManagementListFilterDto filters, int offset, int limit) {
        var params = buildFilterParams(filters);
        params.addValue("offset", offset);
        params.addValue("limit", limit);
        String sql = SELECT + buildFilterWhere(filters)
                + " ORDER BY IFNULL(k.displayName, ''), k.mobile LIMIT :offset, :limit";
        return jdbc.query(sql, params, this::mapRow);
    }

    public long countContacts(KeyManagementListFilterDto filters) {
        String sql = "SELECT COUNT(*) FROM key_management_contacts k " + buildFilterWhere(filters);
        Long count = jdbc.queryForObject(sql, buildFilterParams(filters), Long.class);
        return count != null ? count : 0;
    }

    public Optional<KeyManagementContactDto> findById(long id) {
        List<KeyManagementContactDto> rows = jdbc.query(
                SELECT + " WHERE k.id = :id",
                new MapSqlParameterSource("id", id),
                this::mapRow);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    public Optional<KeyManagementContactDto> findActiveByMobile(String mobile) {
        String digits = mobile != null ? mobile.replaceAll("\\D", "") : "";
        if (digits.isBlank()) {
            return Optional.empty();
        }
        List<KeyManagementContactDto> rows = jdbc.query(
                SELECT + " WHERE k.mobile = :mobile AND k.status = 'ACTIVE' LIMIT 1",
                new MapSqlParameterSource("mobile", digits),
                this::mapRow);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    public Optional<KeyManagementContactDto> findActiveByPortalToken(String portalToken) {
        if (!StringUtils.hasText(portalToken)) {
            return Optional.empty();
        }
        List<KeyManagementContactDto> rows = jdbc.query(
                SELECT + " WHERE k.portal_token = :token AND k.status = 'ACTIVE' LIMIT 1",
                new MapSqlParameterSource("token", portalToken.trim()),
                this::mapRow);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    public boolean existsByMobile(String mobile, Long excludeId) {
        var params = new MapSqlParameterSource()
                .addValue("mobile", mobile)
                .addValue("excludeId", excludeId);
        String sql = """
                SELECT COUNT(*) FROM key_management_contacts
                WHERE mobile = :mobile
                  AND (:excludeId IS NULL OR id <> :excludeId)
                """;
        Long count = jdbc.queryForObject(sql, params, Long.class);
        return count != null && count > 0;
    }

    public long insert(String mobile, String displayName, String portalToken, String actor) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        String token = StringUtils.hasText(portalToken) ? portalToken : UUID.randomUUID().toString();
        jdbc.getJdbcTemplate().update(connection -> {
            var ps = connection.prepareStatement(
                    """
                    INSERT INTO key_management_contacts
                        (mobile, displayName, portal_token, status, createdBy)
                    VALUES (?, ?, ?, 'ACTIVE', ?)
                    """,
                    new String[]{"id"});
            ps.setString(1, mobile);
            ps.setString(2, displayName);
            ps.setString(3, token);
            ps.setString(4, actor);
            return ps;
        }, keyHolder);
        Number key = keyHolder.getKey();
        if (key == null) {
            throw new IllegalStateException("Failed to obtain key_management_contacts id.");
        }
        return key.longValue();
    }

    public int update(long id, String mobile, String displayName, String actor) {
        return jdbc.update(
                """
                UPDATE key_management_contacts
                SET mobile = :mobile,
                    displayName = :displayName,
                    modifiedBy = :actor
                WHERE id = :id
                """,
                new MapSqlParameterSource()
                        .addValue("id", id)
                        .addValue("mobile", mobile)
                        .addValue("displayName", displayName)
                        .addValue("actor", actor));
    }

    public int regeneratePortalToken(long id, String portalToken, String actor) {
        return jdbc.update(
                """
                UPDATE key_management_contacts
                SET portal_token = :token,
                    modifiedBy = :actor
                WHERE id = :id
                """,
                new MapSqlParameterSource()
                        .addValue("id", id)
                        .addValue("token", portalToken)
                        .addValue("actor", actor));
    }

    public int delete(long id) {
        return jdbc.update(
                "DELETE FROM key_management_contacts WHERE id = :id",
                new MapSqlParameterSource("id", id));
    }

    private String buildFilterWhere(KeyManagementListFilterDto filters) {
        StringBuilder where = new StringBuilder(" WHERE 1=1");
        if (StringUtils.hasText(filters.getMobile())) {
            where.append(" AND k.mobile LIKE :mobile");
        }
        if (StringUtils.hasText(filters.getDisplayName())) {
            where.append(" AND LOWER(IFNULL(k.displayName,'')) LIKE :displayName");
        }
        if (StringUtils.hasText(filters.getStatus())) {
            where.append(" AND k.status = :status");
        }
        return where.toString();
    }

    private MapSqlParameterSource buildFilterParams(KeyManagementListFilterDto filters) {
        var params = new MapSqlParameterSource();
        if (StringUtils.hasText(filters.getMobile())) {
            params.addValue("mobile", "%" + filters.getMobile().trim() + "%");
        }
        if (StringUtils.hasText(filters.getDisplayName())) {
            params.addValue("displayName", "%" + filters.getDisplayName().trim().toLowerCase() + "%");
        }
        if (StringUtils.hasText(filters.getStatus())) {
            params.addValue("status", filters.getStatus().trim().toUpperCase());
        }
        return params;
    }

    private KeyManagementContactDto mapRow(ResultSet rs, int rowNum) throws SQLException {
        return KeyManagementContactDto.builder()
                .id(rs.getLong("id"))
                .mobile(rs.getString("mobile"))
                .displayName(rs.getString("displayName"))
                .portalToken(rs.getString("portal_token"))
                .active("ACTIVE".equalsIgnoreCase(rs.getString("status")))
                .createdAt(toLocalDateTime(rs.getTimestamp("createdAt")))
                .modifiedAt(toLocalDateTime(rs.getTimestamp("modifiedAt")))
                .build();
    }

    private static LocalDateTime toLocalDateTime(Timestamp ts) {
        return ts != null ? ts.toLocalDateTime() : null;
    }
}
