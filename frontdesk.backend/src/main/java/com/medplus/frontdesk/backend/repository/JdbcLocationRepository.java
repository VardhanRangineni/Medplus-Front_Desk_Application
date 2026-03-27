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

import com.medplus.frontdesk.backend.dto.location.CreateLocationDto;
import com.medplus.frontdesk.backend.dto.location.LocationDto;
import com.medplus.frontdesk.backend.dto.location.UpdateLocationDto;

@Repository
public class JdbcLocationRepository implements LocationRepository {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public JdbcLocationRepository(
            @Qualifier("medplusNamedParameterJdbcTemplate") NamedParameterJdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    // ── Read ─────────────────────────────────────────────────────────────────

    @Override
    public List<LocationDto> findAll(String search, String status, int offset, int limit) {
        StringBuilder sql = new StringBuilder("""
                SELECT LocationId, descriptiveName, type, coordinates,
                       address, city, state, pincode, status,
                       createdBy, modifiedBy, createdAt, modifiedAt
                FROM `Locations`
                WHERE 1=1
                """);

        MapSqlParameterSource params = new MapSqlParameterSource();
        appendFilters(sql, params, search, status);

        sql.append(" ORDER BY descriptiveName LIMIT :limit OFFSET :offset");
        params.addValue("limit", limit).addValue("offset", offset);

        return jdbcTemplate.query(sql.toString(), params, locationRowMapper());
    }

    @Override
    public int countAll(String search, String status) {
        StringBuilder sql = new StringBuilder("SELECT COUNT(*) FROM `Locations` WHERE 1=1");
        MapSqlParameterSource params = new MapSqlParameterSource();
        appendFilters(sql, params, search, status);

        Integer count = jdbcTemplate.queryForObject(sql.toString(), params, Integer.class);
        return count == null ? 0 : count;
    }

    @Override
    public LocationDto findById(String locationId) {
        String sql = """
                SELECT LocationId, descriptiveName, type, coordinates,
                       address, city, state, pincode, status,
                       createdBy, modifiedBy, createdAt, modifiedAt
                FROM `Locations` WHERE LocationId = :id
                """;
        List<LocationDto> rows = jdbcTemplate.query(sql,
                new MapSqlParameterSource("id", locationId), locationRowMapper());
        return rows.isEmpty() ? null : rows.get(0);
    }

    @Override
    public boolean existsById(String locationId) {
        String sql = "SELECT COUNT(*) FROM `Locations` WHERE LocationId = :id";
        Integer count = jdbcTemplate.queryForObject(sql,
                new MapSqlParameterSource("id", locationId), Integer.class);
        return count != null && count > 0;
    }

    // ── Write ─────────────────────────────────────────────────────────────────

    @Override
    public void insert(String createdBy, String locationId, CreateLocationDto dto) {
        String sql = """
                INSERT INTO `Locations`
                    (LocationId, descriptiveName, type, coordinates,
                     address, city, state, pincode, status,
                     createdBy, modifiedBy, createdAt, modifiedAt)
                VALUES
                    (:locationId, :descriptiveName, :type, :coordinates,
                     :address, :city, :state, :pincode, :status,
                     :createdBy, :createdBy, NOW(), NOW())
                """;

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("locationId",      locationId)
                .addValue("descriptiveName", dto.getDescriptiveName())
                .addValue("type",            dto.getType())
                .addValue("coordinates",     dto.getCoordinates())
                .addValue("address",         dto.getAddress())
                .addValue("city",            dto.getCity())
                .addValue("state",           dto.getState())
                .addValue("pincode",         dto.getPincode())
                .addValue("status",          dto.getStatus())
                .addValue("createdBy",       createdBy);

        jdbcTemplate.update(sql, params);
    }

    @Override
    public int countByIdPrefix(String prefix) {
        String sql = "SELECT COUNT(*) FROM `Locations` WHERE LocationId LIKE :pattern";
        Integer count = jdbcTemplate.queryForObject(sql,
                new MapSqlParameterSource("pattern", prefix + "%"), Integer.class);
        return count == null ? 0 : count;
    }

    @Override
    public void update(String locationId, String modifiedBy, UpdateLocationDto dto) {
        String sql = """
                UPDATE `Locations`
                SET descriptiveName = :descriptiveName,
                    type            = :type,
                    coordinates     = :coordinates,
                    address         = :address,
                    city            = :city,
                    state           = :state,
                    pincode         = :pincode,
                    status          = :status,
                    modifiedBy      = :modifiedBy,
                    modifiedAt      = NOW()
                WHERE LocationId = :locationId
                """;

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("locationId",      locationId)
                .addValue("descriptiveName", dto.getDescriptiveName())
                .addValue("type",            dto.getType())
                .addValue("coordinates",     dto.getCoordinates())
                .addValue("address",         dto.getAddress())
                .addValue("city",            dto.getCity())
                .addValue("state",           dto.getState())
                .addValue("pincode",         dto.getPincode())
                .addValue("status",          dto.getStatus())
                .addValue("modifiedBy",      modifiedBy);

        jdbcTemplate.update(sql, params);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private void appendFilters(StringBuilder sql, MapSqlParameterSource params,
                                String search, String status) {
        if (search != null && !search.isBlank()) {
            sql.append(" AND (descriptiveName LIKE :search OR LocationId LIKE :search" +
                       " OR city LIKE :search OR state LIKE :search)");
            params.addValue("search", "%" + search.trim() + "%");
        }
        if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
            sql.append(" AND status = :status");
            params.addValue("status", status.trim());
        }
    }

    private RowMapper<LocationDto> locationRowMapper() {
        return (rs, rowNum) -> new LocationDto(
                rs.getString("LocationId"),
                rs.getString("descriptiveName"),
                rs.getString("type"),
                rs.getString("coordinates"),
                rs.getString("address"),
                rs.getString("city"),
                rs.getString("state"),
                rs.getString("pincode"),
                rs.getString("status"),
                rs.getString("createdBy"),
                rs.getString("modifiedBy"),
                getLocalDateTime(rs, "createdAt"),
                getLocalDateTime(rs, "modifiedAt"));
    }

    private LocalDateTime getLocalDateTime(ResultSet rs, String col) throws SQLException {
        var ts = rs.getTimestamp(col);
        return ts == null ? null : ts.toLocalDateTime();
    }
}
