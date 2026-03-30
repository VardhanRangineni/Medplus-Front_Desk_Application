package com.medplus.frontdesk_backend.repository;

import com.medplus.frontdesk_backend.model.Location;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
@RequiredArgsConstructor
public class LocationRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public List<Location> findAll() {
        String sql = """
                SELECT LocationId, descriptiveName, type, coordinates, address, city, state, pincode, status
                FROM locationmaster
                ORDER BY descriptiveName
                """;
        return jdbc.query(sql, new MapSqlParameterSource(), (rs, rowNum) -> Location.builder()
                .locationId(rs.getString("LocationId"))
                .descriptiveName(rs.getString("descriptiveName"))
                .type(rs.getString("type"))
                .coordinates(rs.getString("coordinates"))
                .address(rs.getString("address"))
                .city(rs.getString("city"))
                .state(rs.getString("state"))
                .pincode(rs.getString("pincode"))
                .status(rs.getString("status"))
                .build()
        );
    }

    public int updateStatus(String locationId, String status) {
        String sql = """
                UPDATE locationmaster
                SET status = :status, modifiedBy = 'APP'
                WHERE LocationId = :locationId
                """;
        return jdbc.update(sql, new MapSqlParameterSource()
                .addValue("locationId", locationId)
                .addValue("status", status)
        );
    }
}
