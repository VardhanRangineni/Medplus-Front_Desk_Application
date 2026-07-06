package com.medplus.frontdesk_backend.repository;

import com.medplus.frontdesk_backend.dto.LocationDto;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Location dropdown options from {@code location_master}, with legacy fallback
 * to distinct values on {@code usermanagement}.
 */
@Repository
@RequiredArgsConstructor
public class LocationRepository {

    private final NamedParameterJdbcTemplate jdbc;
    private final LocationMasterRepository locationMasterRepository;

    public List<LocationDto> searchByQuery(String query) {
        if (hasLocationMasterRows()) {
            return locationMasterRepository.searchActiveLocations(query).stream()
                    .map(lm -> LocationDto.builder()
                            .code(lm.getLocationId())
                            .name(lm.getDescriptiveName())
                            .address(lm.getAddress())
                            .city(lm.getCityName())
                            .state(lm.getStateName())
                            .status(true)
                            .build())
                    .toList();
        }
        return searchFromUserManagement(query);
    }

    public List<LocationDto> findAllActive() {
        if (hasLocationMasterRows()) {
            return locationMasterRepository.findActiveLocationsForDropdown().stream()
                    .map(lm -> LocationDto.builder()
                            .code(lm.getLocationId())
                            .name(lm.getDescriptiveName())
                            .address(lm.getAddress())
                            .city(lm.getCityName())
                            .state(lm.getStateName())
                            .status(true)
                            .build())
                    .toList();
        }
        return findActiveFromUserManagement();
    }

    public Optional<String> findLocationNameByCode(String code) {
        Optional<String> fromMaster = locationMasterRepository.findLocationNameByCode(code);
        if (fromMaster.isPresent()) {
            return fromMaster;
        }
        String sql = """
                SELECT COALESCE(NULLIF(locationName, ''), location) AS name
                FROM usermanagement
                WHERE location = :code
                LIMIT 1
                """;
        List<String> rows = jdbc.query(sql, new MapSqlParameterSource("code", code),
                (rs, rowNum) -> rs.getString("name"));
        return rows.isEmpty() ? Optional.empty() : Optional.ofNullable(rows.get(0));
    }

    private boolean hasLocationMasterRows() {
        Long count = jdbc.queryForObject("SELECT COUNT(*) FROM location_master", new MapSqlParameterSource(), Long.class);
        return count != null && count > 0;
    }

    private List<LocationDto> searchFromUserManagement(String query) {
        String like = "%" + query.trim().toLowerCase() + "%";
        String sql = """
                SELECT DISTINCT location AS code,
                       COALESCE(NULLIF(locationName, ''), location) AS name
                FROM usermanagement
                WHERE TRIM(location) != ''
                  AND (LOWER(location) LIKE :like OR LOWER(locationName) LIKE :like)
                ORDER BY name
                LIMIT 20
                """;
        return jdbc.query(sql, new MapSqlParameterSource("like", like), this::mapUserMgmtRow);
    }

    private List<LocationDto> findActiveFromUserManagement() {
        String sql = """
                SELECT DISTINCT location AS code,
                       COALESCE(NULLIF(locationName, ''), location) AS name
                FROM usermanagement
                WHERE TRIM(location) != ''
                  AND status = 'ACTIVE'
                ORDER BY name
                """;
        return jdbc.query(sql, new MapSqlParameterSource(), this::mapUserMgmtRow);
    }

    private LocationDto mapUserMgmtRow(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
        return LocationDto.builder()
                .code(rs.getString("code"))
                .name(rs.getString("name"))
                .status(true)
                .build();
    }
}
