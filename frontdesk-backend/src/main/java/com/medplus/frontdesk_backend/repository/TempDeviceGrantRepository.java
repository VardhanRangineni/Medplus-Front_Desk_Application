package com.medplus.frontdesk_backend.repository;

import com.medplus.frontdesk_backend.dto.TempDeviceGrantDto;
import com.medplus.frontdesk_backend.model.TempDeviceGrantStatus;
import com.medplus.frontdesk_backend.util.WorkstationMacUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class TempDeviceGrantRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public long insert(String employeeId, String macAddress, LocalDateTime expiresAt,
                       String grantedBy, String reason) {
        String sql = """
                INSERT INTO user_temp_device_grants
                    (employeeId, macAddress, expiresAt, grantedBy, reason, status)
                VALUES (:employeeId, :macAddress, :expiresAt, :grantedBy, :reason, 'ACTIVE')
                """;
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("employeeId", employeeId)
                .addValue("macAddress", WorkstationMacUtil.toStoredValue(macAddress))
                .addValue("expiresAt", expiresAt)
                .addValue("grantedBy", grantedBy)
                .addValue("reason", reason.trim());

        var keyHolder = new org.springframework.jdbc.support.GeneratedKeyHolder();
        jdbc.update(sql, params, keyHolder, new String[] { "id" });
        Number key = keyHolder.getKey();
        return key != null ? key.longValue() : 0L;
    }

    public void revokeActiveForEmployee(String employeeId, String revokedBy) {
        String sql = """
                UPDATE user_temp_device_grants
                SET status = 'REVOKED', revokedBy = :revokedBy, revokedAt = NOW()
                WHERE employeeId = :employeeId AND status = 'ACTIVE'
                """;
        jdbc.update(sql, new MapSqlParameterSource()
                .addValue("employeeId", employeeId)
                .addValue("revokedBy", revokedBy));
    }

    public void markExpiredGrants() {
        jdbc.update("""
                UPDATE user_temp_device_grants
                SET status = 'EXPIRED'
                WHERE status = 'ACTIVE' AND expiresAt <= NOW()
                """, new MapSqlParameterSource());
    }

    public Optional<TempDeviceGrantDto> findActiveByEmployeeAndMac(String employeeId, String incomingMac) {
        markExpiredGrants();
        String normalized = WorkstationMacUtil.normalize(incomingMac);
        if (normalized.isEmpty()) {
            return Optional.empty();
        }

        String sql = """
                SELECT g.id, g.employeeId, um.fullName AS employeeName,
                       g.macAddress, g.expiresAt, g.grantedBy, g.reason,
                       g.status, g.revokedBy, g.revokedAt, g.createdAt
                FROM user_temp_device_grants g
                JOIN usermanagement um ON um.employeeid = g.employeeId
                WHERE g.employeeId = :employeeId
                  AND g.status = 'ACTIVE'
                  AND g.expiresAt > NOW()
                ORDER BY g.createdAt DESC
                """;

        return jdbc.query(sql, new MapSqlParameterSource("employeeId", employeeId), this::mapRow)
                .stream()
                .filter(g -> WorkstationMacUtil.matches(g.getMacAddress(), normalized))
                .findFirst();
    }

    public Optional<TempDeviceGrantDto> findActiveByEmployee(String employeeId) {
        markExpiredGrants();
        String sql = """
                SELECT g.id, g.employeeId, um.fullName AS employeeName,
                       g.macAddress, g.expiresAt, g.grantedBy, g.reason,
                       g.status, g.revokedBy, g.revokedAt, g.createdAt
                FROM user_temp_device_grants g
                JOIN usermanagement um ON um.employeeid = g.employeeId
                WHERE g.employeeId = :employeeId
                  AND g.status = 'ACTIVE'
                  AND g.expiresAt > NOW()
                ORDER BY g.createdAt DESC
                LIMIT 1
                """;
        List<TempDeviceGrantDto> rows = jdbc.query(sql,
                new MapSqlParameterSource("employeeId", employeeId), this::mapRow);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    public Optional<TempDeviceGrantDto> findById(long id) {
        String sql = """
                SELECT g.id, g.employeeId, um.fullName AS employeeName,
                       g.macAddress, g.expiresAt, g.grantedBy, g.reason,
                       g.status, g.revokedBy, g.revokedAt, g.createdAt
                FROM user_temp_device_grants g
                JOIN usermanagement um ON um.employeeid = g.employeeId
                WHERE g.id = :id
                """;
        List<TempDeviceGrantDto> rows = jdbc.query(sql,
                new MapSqlParameterSource("id", id), this::mapRow);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    public List<TempDeviceGrantDto> findHistoryByEmployee(String employeeId, int limit) {
        markExpiredGrants();
        String sql = """
                SELECT g.id, g.employeeId, um.fullName AS employeeName,
                       g.macAddress, g.expiresAt, g.grantedBy, g.reason,
                       g.status, g.revokedBy, g.revokedAt, g.createdAt
                FROM user_temp_device_grants g
                JOIN usermanagement um ON um.employeeid = g.employeeId
                WHERE g.employeeId = :employeeId
                ORDER BY g.createdAt DESC
                LIMIT :limit
                """;
        return jdbc.query(sql, new MapSqlParameterSource()
                .addValue("employeeId", employeeId)
                .addValue("limit", limit), this::mapRow);
    }

    private TempDeviceGrantDto mapRow(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
        return TempDeviceGrantDto.builder()
                .id(rs.getLong("id"))
                .employeeId(rs.getString("employeeId"))
                .employeeName(rs.getString("employeeName"))
                .macAddress(rs.getString("macAddress"))
                .expiresAt(rs.getTimestamp("expiresAt") != null
                        ? rs.getTimestamp("expiresAt").toLocalDateTime() : null)
                .grantedBy(rs.getString("grantedBy"))
                .reason(rs.getString("reason"))
                .status(rs.getString("status"))
                .revokedBy(rs.getString("revokedBy"))
                .revokedAt(rs.getTimestamp("revokedAt") != null
                        ? rs.getTimestamp("revokedAt").toLocalDateTime() : null)
                .createdAt(rs.getTimestamp("createdAt") != null
                        ? rs.getTimestamp("createdAt").toLocalDateTime() : null)
                .build();
    }
}
