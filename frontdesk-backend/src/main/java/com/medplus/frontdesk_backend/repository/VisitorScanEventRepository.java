package com.medplus.frontdesk_backend.repository;

import com.medplus.frontdesk_backend.dto.VisitorMovementEventDto;
import com.medplus.frontdesk_backend.model.VisitorScanEventType;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class VisitorScanEventRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public long insert(String visitorId, String locationId, String deviceId,
                       VisitorScanEventType eventType, String preregToken,
                       String scannedBy, String deviceMac, LocalDateTime scannedAt) {
        String sql = """
                INSERT INTO visitor_scan_events
                    (visitorId, locationId, deviceId, eventType, preregToken, scannedBy, deviceMac, scannedAt)
                VALUES
                    (:visitorId, :locationId, :deviceId, :eventType, :preregToken, :scannedBy, :deviceMac, :scannedAt)
                """;
        var keyHolder = new org.springframework.jdbc.support.GeneratedKeyHolder();
        jdbc.update(sql, new MapSqlParameterSource()
                .addValue("visitorId", visitorId)
                .addValue("locationId", locationId)
                .addValue("deviceId", deviceId)
                .addValue("eventType", eventType.name())
                .addValue("preregToken", preregToken)
                .addValue("scannedBy", scannedBy)
                .addValue("deviceMac", deviceMac)
                .addValue("scannedAt", scannedAt), keyHolder, new String[] { "id" });
        Number key = keyHolder.getKey();
        return key != null ? key.longValue() : 0L;
    }

    public Optional<LocalDateTime> findLastZoneScanAt(String visitorId, String deviceId) {
        String sql = """
                SELECT scannedAt FROM visitor_scan_events
                WHERE visitorId = :visitorId
                  AND deviceId = :deviceId
                  AND eventType = 'ZONE_SCAN'
                ORDER BY scannedAt DESC
                LIMIT 1
                """;
        return jdbc.query(sql, new MapSqlParameterSource()
                        .addValue("visitorId", visitorId)
                        .addValue("deviceId", deviceId),
                (rs, rowNum) -> rs.getTimestamp("scannedAt").toLocalDateTime())
                .stream().findFirst();
    }

    public List<VisitorMovementEventDto> findMovementByVisitorId(String visitorId) {
        String sql = """
                SELECT e.id, e.visitorId, e.locationId, lm.descriptiveName AS locationName,
                       e.deviceId, d.displayName AS deviceName, d.floor, d.area,
                       e.eventType, e.scannedBy, e.scannedAt
                FROM visitor_scan_events e
                LEFT JOIN device_master d ON d.deviceId = e.deviceId
                LEFT JOIN location_master lm ON lm.locationId = e.locationId
                WHERE e.visitorId = :visitorId
                ORDER BY e.scannedAt ASC, e.id ASC
                """;
        return jdbc.query(sql, new MapSqlParameterSource("visitorId", visitorId), this::mapMovement);
    }

    private VisitorMovementEventDto mapMovement(ResultSet rs, int rowNum) throws SQLException {
        Timestamp scannedAt = rs.getTimestamp("scannedAt");
        return VisitorMovementEventDto.builder()
                .id(rs.getLong("id"))
                .eventType(rs.getString("eventType"))
                .deviceId(rs.getString("deviceId"))
                .deviceName(rs.getString("deviceName"))
                .locationId(rs.getString("locationId"))
                .locationName(rs.getString("locationName"))
                .floor(rs.getString("floor"))
                .area(rs.getString("area"))
                .scannedAt(scannedAt != null ? scannedAt.toLocalDateTime() : null)
                .scannedBy(rs.getString("scannedBy"))
                .build();
    }
}
