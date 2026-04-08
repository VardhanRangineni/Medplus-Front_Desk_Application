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

    /**
     * Returns one page of locations, optionally filtered by a search term and/or a
     * specific {@code locationId} (used to scope REGIONAL_ADMIN to their own location).
     *
     * @param search     case-insensitive substring; null / blank = no filter
     * @param locationId restrict to a single location; null = all locations
     * @param offset     SQL OFFSET (page * size)
     * @param limit      SQL LIMIT  (page size)
     */
    public List<Location> findAllPaged(String search, String locationId, int offset, int limit) {
        boolean hasSearch   = search     != null && !search.isBlank();
        boolean hasLocation = locationId != null && !locationId.isBlank();
        String like = hasSearch ? "%" + search.trim().toLowerCase() + "%" : null;

        StringBuilder sql = new StringBuilder("""
                SELECT LocationId, descriptiveName, type, coordinates, address, city, state, pincode, status
                FROM locationmaster
                WHERE 1=1
                """);

        MapSqlParameterSource params = new MapSqlParameterSource();
        if (hasLocation) {
            sql.append(" AND LocationId = :locationId");
            params.addValue("locationId", locationId);
        }
        if (hasSearch) {
            sql.append("""
                     AND (
                        LOWER(LocationId)       LIKE :q
                     OR LOWER(descriptiveName)  LIKE :q
                     OR LOWER(city)             LIKE :q
                    )
                    """);
            params.addValue("q", like);
        }

        sql.append("ORDER BY descriptiveName\nLIMIT :limit OFFSET :offset");
        params.addValue("limit", limit).addValue("offset", offset);

        return jdbc.query(sql.toString(), params, (rs, rowNum) -> Location.builder()
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

    /** Total count of locations matching the same optional search and location filter. */
    public long countAll(String search, String locationId) {
        boolean hasSearch   = search     != null && !search.isBlank();
        boolean hasLocation = locationId != null && !locationId.isBlank();
        MapSqlParameterSource params = new MapSqlParameterSource();
        StringBuilder sql = new StringBuilder("SELECT COUNT(*) FROM locationmaster WHERE 1=1 ");
        if (hasLocation) {
            sql.append(" AND LocationId = :locationId");
            params.addValue("locationId", locationId);
        }
        if (hasSearch) {
            sql.append("""
                     AND (
                        LOWER(LocationId)       LIKE :q
                     OR LOWER(descriptiveName)  LIKE :q
                     OR LOWER(city)             LIKE :q
                    )
                    """);
            params.addValue("q", "%" + search.trim().toLowerCase() + "%");
        }
        Long count = jdbc.queryForObject(sql.toString(), params, Long.class);
        return count == null ? 0L : count;
    }

    /**
     * Searches locationmaster by descriptiveName OR LocationId using a
     * case-insensitive LIKE.  Returns up to 20 matches ordered by descriptiveName.
     *
     * Used by: GET /api/locations/search?q=
     */
    public List<Location> searchByQuery(String query) {
        String like = "%" + query.trim().toLowerCase() + "%";
        String sql = """
                SELECT LocationId, descriptiveName, type, coordinates, address, city, state, pincode, status
                FROM locationmaster
                WHERE LOWER(descriptiveName) LIKE :like
                   OR LOWER(LocationId)      LIKE :like
                ORDER BY descriptiveName
                LIMIT 20
                """;
        return jdbc.query(sql, new MapSqlParameterSource("like", like), (rs, rowNum) -> Location.builder()
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

    /**
     * Returns all active (CONFIGURED) locations ordered by name.
     * Lightweight — used to populate filter dropdowns across the application.
     */
    public List<Location> findAllActive() {
        String sql = """
                SELECT LocationId, descriptiveName, type, coordinates,
                       address, city, state, pincode, status
                FROM   locationmaster
                WHERE  status IN ('CONFIGURED', 'ACTIVE')
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
                .build());
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
