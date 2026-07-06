package com.medplus.frontdesk_backend.repository;

import com.medplus.frontdesk_backend.dto.DeviceListFilterDto;
import com.medplus.frontdesk_backend.dto.DeviceMasterDto;
import com.medplus.frontdesk_backend.util.WorkstationMacUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class DeviceMasterRepository {

    private final NamedParameterJdbcTemplate jdbc;

    private static final String DEVICE_SELECT = """
            SELECT d.deviceId, d.locationId, lm.descriptiveName AS locationName,
                   d.displayName, d.floor, d.area,
                   d.macAddress, d.ipAddress, d.lastKnownIp, d.status,
                   d.createdAt, d.modifiedAt
            FROM device_master d
            INNER JOIN location_master lm ON lm.locationId = d.locationId
            """;

    public List<DeviceMasterDto> findDevices(DeviceListFilterDto filters, int offset, int limit) {
        var params = buildFilterParams(filters);
        params.addValue("offset", offset);
        params.addValue("limit", limit);
        String sql = DEVICE_SELECT + buildFilterWhere(filters)
                + " ORDER BY d.locationId, d.displayName LIMIT :offset, :limit";
        return jdbc.query(sql, params, this::mapDevice);
    }

    public long countDevices(DeviceListFilterDto filters) {
        String sql = "SELECT COUNT(*) FROM device_master d " + buildFilterWhere(filters);
        Long count = jdbc.queryForObject(sql, buildFilterParams(filters), Long.class);
        return count != null ? count : 0;
    }

    public Optional<DeviceMasterDto> findById(String deviceId) {
        String sql = DEVICE_SELECT + " WHERE d.deviceId = :id";
        List<DeviceMasterDto> rows = jdbc.query(sql,
                new MapSqlParameterSource("id", deviceId), this::mapDevice);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    public Map<String, DeviceMasterDto> findByIds(Collection<String> deviceIds) {
        if (deviceIds == null || deviceIds.isEmpty()) {
            return Collections.emptyMap();
        }
        String sql = DEVICE_SELECT + " WHERE d.deviceId IN (:ids)";
        List<DeviceMasterDto> rows = jdbc.query(sql,
                new MapSqlParameterSource("ids", deviceIds), this::mapDevice);
        Map<String, DeviceMasterDto> map = new LinkedHashMap<>();
        for (DeviceMasterDto dto : rows) {
            map.put(dto.getDeviceId(), dto);
        }
        return map;
    }

    public Optional<DeviceMasterDto> findActiveByMac(String mac) {
        String normalized = WorkstationMacUtil.normalize(mac);
        if (normalized.isEmpty()) {
            return Optional.empty();
        }
        String sql = DEVICE_SELECT
                + " WHERE d.status = 'ACTIVE'"
                + " AND REPLACE(REPLACE(UPPER(IFNULL(d.macAddress,'')), ':', ''), '-', '') = :mac";
        List<DeviceMasterDto> rows = jdbc.query(sql,
                new MapSqlParameterSource("mac", normalized), this::mapDevice);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    public int nextSequenceForLocation(String locationId) {
        Integer max = jdbc.queryForObject(
                """
                SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(deviceId, '-D', -1) AS UNSIGNED)), 0)
                FROM device_master
                WHERE locationId = :loc AND deviceId LIKE :pattern
                """,
                new MapSqlParameterSource()
                        .addValue("loc", locationId)
                        .addValue("pattern", locationId + "-D%"),
                Integer.class);
        return max != null ? max + 1 : 1;
    }

    public void insert(String deviceId, String locationId, String displayName,
                       String floor, String area, String macAddress, String ipAddress, String actor) {
        jdbc.update("""
                INSERT INTO device_master
                    (deviceId, locationId, displayName, floor, area, macAddress, ipAddress, status, createdBy)
                VALUES
                    (:deviceId, :locationId, :displayName, :floor, :area, :macAddress, :ipAddress, 'ACTIVE', :actor)
                """,
                new MapSqlParameterSource()
                        .addValue("deviceId", deviceId)
                        .addValue("locationId", locationId)
                        .addValue("displayName", displayName)
                        .addValue("floor", floor)
                        .addValue("area", area)
                        .addValue("macAddress", macAddress)
                        .addValue("ipAddress", ipAddress)
                        .addValue("actor", actor));
    }

    public void update(String deviceId, String displayName, String floor, String area,
                       String macAddress, String ipAddress, String actor) {
        jdbc.update("""
                UPDATE device_master SET
                    displayName = :displayName,
                    floor = :floor,
                    area = :area,
                    macAddress = :macAddress,
                    ipAddress = :ipAddress,
                    modifiedBy = :actor
                WHERE deviceId = :deviceId
                """,
                new MapSqlParameterSource()
                        .addValue("deviceId", deviceId)
                        .addValue("displayName", displayName)
                        .addValue("floor", floor)
                        .addValue("area", area)
                        .addValue("macAddress", macAddress)
                        .addValue("ipAddress", ipAddress)
                        .addValue("actor", actor));
    }

    public void updateStatus(String deviceId, boolean active, String actor) {
        jdbc.update("""
                UPDATE device_master SET
                    status = :status,
                    modifiedBy = :actor
                WHERE deviceId = :deviceId
                """,
                new MapSqlParameterSource()
                        .addValue("deviceId", deviceId)
                        .addValue("status", active ? "ACTIVE" : "INACTIVE")
                        .addValue("actor", actor));
    }

    public void updateLastKnownIp(String deviceId, String ip) {
        if (ip == null || ip.isBlank()) {
            return;
        }
        jdbc.update(
                "UPDATE device_master SET lastKnownIp = :ip WHERE deviceId = :id",
                new MapSqlParameterSource()
                        .addValue("id", deviceId)
                        .addValue("ip", ip.trim()));
    }

    public boolean macUsedByOtherDevice(String mac, String excludeDeviceId) {
        String normalized = WorkstationMacUtil.normalize(mac);
        if (normalized.isEmpty()) {
            return false;
        }
        var params = new MapSqlParameterSource()
                .addValue("mac", normalized)
                .addValue("exclude", excludeDeviceId != null ? excludeDeviceId : "");
        String sql = """
                SELECT COUNT(*) FROM device_master
                WHERE REPLACE(REPLACE(UPPER(IFNULL(macAddress,'')), ':', ''), '-', '') = :mac
                  AND (:exclude = '' OR deviceId <> :exclude)
                """;
        Long count = jdbc.queryForObject(sql, params, Long.class);
        return count != null && count > 0;
    }

    public boolean locationExists(String locationId) {
        Long count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM location_master WHERE locationId = :id",
                new MapSqlParameterSource("id", locationId),
                Long.class);
        return count != null && count > 0;
    }

    private String buildFilterWhere(DeviceListFilterDto filters) {
        return """
                WHERE (
                        (:locationId <> '' AND d.locationId = :locationId)
                     OR (:locationId = '' AND :useLocationIds = 0)
                     OR (:locationId = '' AND :useLocationIds = 1 AND d.locationId IN (:locationIds))
                  )
                  AND (:displayName = '' OR LOWER(d.displayName) LIKE :displayNameLike)
                  AND (:status = '' OR d.status = :status)
                """;
    }

    private MapSqlParameterSource buildFilterParams(DeviceListFilterDto filters) {
        String locationId = filters == null || filters.getLocationId() == null
                ? "" : filters.getLocationId().trim();
        List<String> locationIds = filters != null && filters.getLocationIds() != null
                ? filters.getLocationIds().stream()
                    .filter(id -> id != null && !id.isBlank())
                    .map(String::trim)
                    .distinct()
                    .toList()
                : List.of();
        // NamedParameterJdbcTemplate requires non-empty IN list; use placeholder when unused.
        boolean useLocationIds = locationId.isEmpty() && !locationIds.isEmpty();
        if (!useLocationIds) {
            locationIds = List.of("__none__");
        }
        String displayName = filters == null || filters.getDisplayName() == null
                ? "" : filters.getDisplayName().trim();
        String status = filters == null || filters.getStatus() == null
                ? "" : filters.getStatus().trim().toUpperCase();
        if ("ACTIVE".equals(status)) {
            status = "ACTIVE";
        } else if ("INACTIVE".equals(status)) {
            status = "INACTIVE";
        } else if (!status.isEmpty() && !"ACTIVE".equals(status) && !"INACTIVE".equals(status)) {
            status = "";
        }
        return new MapSqlParameterSource()
                .addValue("locationId", locationId)
                .addValue("useLocationIds", useLocationIds ? 1 : 0)
                .addValue("locationIds", locationIds)
                .addValue("displayName", displayName)
                .addValue("displayNameLike", "%" + displayName.toLowerCase() + "%")
                .addValue("status", status);
    }

    private DeviceMasterDto mapDevice(ResultSet rs, int rowNum) throws SQLException {
        Timestamp created = rs.getTimestamp("createdAt");
        Timestamp modified = rs.getTimestamp("modifiedAt");
        return DeviceMasterDto.builder()
                .deviceId(rs.getString("deviceId"))
                .locationId(rs.getString("locationId"))
                .locationName(rs.getString("locationName"))
                .displayName(rs.getString("displayName"))
                .floor(rs.getString("floor"))
                .area(rs.getString("area"))
                .macAddress(rs.getString("macAddress"))
                .ipAddress(rs.getString("ipAddress"))
                .lastKnownIp(rs.getString("lastKnownIp"))
                .active("ACTIVE".equalsIgnoreCase(rs.getString("status")))
                .createdAt(created != null ? created.toLocalDateTime() : null)
                .modifiedAt(modified != null ? modified.toLocalDateTime() : null)
                .build();
    }
}
