package com.medplus.frontdesk_backend.repository;

import com.medplus.frontdesk_backend.dto.ManagedUserDto;
import com.medplus.frontdesk_backend.dto.UserDto;
import com.medplus.frontdesk_backend.dto.UserLookupDto;
import com.medplus.frontdesk_backend.model.UserManagement;
import com.medplus.frontdesk_backend.model.UserMaster;
import com.medplus.frontdesk_backend.model.UserRole;
import com.medplus.frontdesk_backend.model.UserStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class UserRepository {

    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;

    // ── UserManagement ────────────────────────────────────────────────────────

    public Optional<UserManagement> findByEmployeeId(String employeeId) {
        String sql = """
                SELECT employeeid, fullName, ipaddress, password, location, status, role, macaddress
                FROM usermanagement
                WHERE employeeid = :employeeId
                """;
        MapSqlParameterSource params = new MapSqlParameterSource("employeeId", employeeId);

        List<UserManagement> results = namedParameterJdbcTemplate.query(sql, params,
                (rs, rowNum) -> UserManagement.builder()
                        .employeeid(rs.getString("employeeid"))
                        .fullName(rs.getString("fullName"))
                        .ipaddress(rs.getString("ipaddress"))
                        .password(rs.getString("password"))
                        .location(rs.getString("location"))
                        .status(UserStatus.valueOf(rs.getString("status")))
                        .role(UserRole.valueOf(rs.getString("role")))
                        .macaddress(rs.getString("macaddress"))
                        .build()
        );

        return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
    }

    public boolean existsInUserManagement(String employeeId) {
        String sql = "SELECT COUNT(*) FROM usermanagement WHERE employeeid = :employeeId";
        MapSqlParameterSource params = new MapSqlParameterSource("employeeId", employeeId);
        Integer count = namedParameterJdbcTemplate.queryForObject(sql, params, Integer.class);
        return count != null && count > 0;
    }

    public void insertUserManagement(String employeeId, String fullName, String encodedPassword,
                                     String locationId, UserStatus status, UserRole role, String ipaddress) {
        String sql = """
                INSERT INTO usermanagement (employeeid, fullName, ipaddress, password, location, status, role, createdBy)
                VALUES (:employeeId, :fullName, :ipaddress, :password, :location, :status, :role, 'SYSTEM')
                """;
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("employeeId", employeeId)
                .addValue("fullName", fullName)
                .addValue("ipaddress", ipaddress)
                .addValue("password", encodedPassword)
                .addValue("location", locationId)
                .addValue("status", status.name())
                .addValue("role", role.name());
        namedParameterJdbcTemplate.update(sql, params);
    }

    public void updateMacAddress(String employeeId, String macAddress) {
        String sql = """
                UPDATE usermanagement
                SET macaddress = :macAddress
                WHERE employeeid = :employeeId
                """;
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("employeeId", employeeId)
                .addValue("macAddress", macAddress);
        namedParameterJdbcTemplate.update(sql, params);
    }

    public void updateIpAndMac(String employeeId, String ipAddress, String macAddress) {
        String sql = """
                UPDATE usermanagement
                SET ipaddress = :ipAddress, macaddress = :macAddress
                WHERE employeeid = :employeeId
                """;
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("employeeId", employeeId)
                .addValue("ipAddress", ipAddress)
                .addValue("macAddress", macAddress);
        namedParameterJdbcTemplate.update(sql, params);
    }

    // ── UserMaster ────────────────────────────────────────────────────────────

    public Optional<UserMaster> findUserMasterByEmployeeId(String employeeId) {
        String sql = """
                SELECT employeeid, fullName, workemail, phone, designation, role, worklocation, department
                FROM usermaster
                WHERE employeeid = :employeeId
                """;
        MapSqlParameterSource params = new MapSqlParameterSource("employeeId", employeeId);

        List<UserMaster> results = namedParameterJdbcTemplate.query(sql, params,
                (rs, rowNum) -> UserMaster.builder()
                        .employeeid(rs.getString("employeeid"))
                        .fullName(rs.getString("fullName"))
                        .workemail(rs.getString("workemail"))
                        .phone(rs.getString("phone"))
                        .designation(rs.getString("designation"))
                        .role(rs.getString("role"))
                        .worklocation(rs.getString("worklocation"))
                        .department(rs.getString("department"))
                        .build()
        );

        return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
    }

    /**
     * Batch-loads work phones from {@code usermaster} for the given employee IDs.
     * IDs missing from HR master or with blank phone are omitted from the map.
     */
    public Map<String, String> findPhonesByEmployeeIds(Collection<String> employeeIds) {
        if (employeeIds == null || employeeIds.isEmpty()) {
            return Map.of();
        }
        List<String> ids = employeeIds.stream()
                .filter(id -> id != null && !id.isBlank())
                .map(String::trim)
                .distinct()
                .toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        String sql = "SELECT employeeid, phone FROM usermaster WHERE employeeid IN (:ids)";
        MapSqlParameterSource params = new MapSqlParameterSource("ids", ids);
        return namedParameterJdbcTemplate.query(sql, params, rs -> {
            Map<String, String> out = new HashMap<>();
            while (rs.next()) {
                String id = rs.getString("employeeid");
                String ph = rs.getString("phone");
                if (id != null && ph != null && !ph.isBlank()) {
                    out.put(id.trim(), ph.trim());
                }
            }
            return out;
        });
    }

    /**
     * Returns all employees from usermaster joined with their system role from usermanagement.
     * The HR display role (usermaster.role) is preferred; falls back to the system role.
     */
    public List<UserDto> findAllUserDtos() {
        String sql = """
                SELECT um.employeeid,
                       COALESCE(umgmt.fullName, um.fullName) AS displayName,
                       um.workemail, um.phone,
                       um.designation, um.worklocation, um.department,
                       um.role    AS hr_role,
                       umgmt.role AS sys_role
                FROM usermaster um
                LEFT JOIN usermanagement umgmt ON um.employeeid = umgmt.employeeid
                ORDER BY displayName
                """;
        return namedParameterJdbcTemplate.query(sql, new MapSqlParameterSource(),
                (rs, rowNum) -> {
                    String hrRole  = rs.getString("hr_role");
                    String sysRole = rs.getString("sys_role");
                    String displayRole = (hrRole != null && !hrRole.isBlank()) ? hrRole
                            : (sysRole != null ? sysRole : "");
                    return UserDto.builder()
                            .id(rs.getString("employeeid"))
                            .name(rs.getString("displayName"))
                            .role(displayRole)
                            .designation(rs.getString("designation"))
                            .dept(rs.getString("department"))
                            .workLocation(rs.getString("worklocation"))
                            .email(rs.getString("workemail"))
                            .phone(rs.getString("phone"))
                            .build();
                }
        );
    }

    /**
     * Returns one page of UserDtos, optionally filtered by a search term and/or locationId.
     *
     * When {@code locationId} is non-null, only employees whose {@code worklocation} matches
     * the descriptive name of that location (or who are registered in usermanagement for
     * that location) are returned.
     *
     * @param search     case-insensitive substring; null / blank = no filter
     * @param locationId LocationId FK from locationmaster; null = all locations
     * @param offset     SQL OFFSET (page * size)
     * @param limit      SQL LIMIT  (page size)
     */
    public List<UserDto> findUserDtosPaged(String search, String locationId, int offset, int limit) {
        boolean hasSearch   = search     != null && !search.isBlank();
        boolean hasLocation = locationId != null && !locationId.isBlank();
        String like = hasSearch ? "%" + search.trim().toLowerCase() + "%" : null;

        StringBuilder sql = new StringBuilder("""
                SELECT um.employeeid,
                       COALESCE(umgmt.fullName, um.fullName) AS displayName,
                       um.workemail, um.phone,
                       um.designation, um.worklocation, um.department,
                       um.role    AS hr_role,
                       umgmt.role AS sys_role
                FROM usermaster um
                LEFT JOIN usermanagement umgmt ON um.employeeid = umgmt.employeeid
                LEFT JOIN locationmaster lm
                       ON LOWER(TRIM(um.worklocation)) = LOWER(TRIM(lm.descriptiveName))
                WHERE 1=1
                """);

        MapSqlParameterSource params = new MapSqlParameterSource();
        if (hasLocation) {
            sql.append(" AND (lm.LocationId = :locationId OR umgmt.location = :locationId)");
            params.addValue("locationId", locationId);
        }
        if (hasSearch) {
            sql.append("""
                     AND (
                        LOWER(um.employeeid)   LIKE :q
                     OR LOWER(um.fullName)     LIKE :q
                     OR LOWER(um.department)   LIKE :q
                     OR LOWER(um.worklocation) LIKE :q
                    )
                    """);
            params.addValue("q", like);
        }

        sql.append("ORDER BY displayName\nLIMIT :limit OFFSET :offset");
        params.addValue("limit", limit).addValue("offset", offset);

        return namedParameterJdbcTemplate.query(sql.toString(), params, (rs, rowNum) -> {
            String hrRole  = rs.getString("hr_role");
            String sysRole = rs.getString("sys_role");
            String displayRole = (hrRole != null && !hrRole.isBlank()) ? hrRole
                    : (sysRole != null ? sysRole : "");
            return UserDto.builder()
                    .id(rs.getString("employeeid"))
                    .name(rs.getString("displayName"))
                    .role(displayRole)
                    .designation(rs.getString("designation"))
                    .dept(rs.getString("department"))
                    .workLocation(rs.getString("worklocation"))
                    .email(rs.getString("workemail"))
                    .phone(rs.getString("phone"))
                    .build();
        });
    }

    /** Total count matching the same optional search and location — used for totalPages calculation. */
    public long countUserDtos(String search, String locationId) {
        boolean hasSearch   = search     != null && !search.isBlank();
        boolean hasLocation = locationId != null && !locationId.isBlank();
        MapSqlParameterSource params = new MapSqlParameterSource();
        StringBuilder sql = new StringBuilder("""
                SELECT COUNT(*) FROM usermaster um
                LEFT JOIN usermanagement umgmt ON um.employeeid = umgmt.employeeid
                LEFT JOIN locationmaster lm
                       ON LOWER(TRIM(um.worklocation)) = LOWER(TRIM(lm.descriptiveName))
                WHERE 1=1
                """);
        if (hasLocation) {
            sql.append(" AND (lm.LocationId = :locationId OR umgmt.location = :locationId)");
            params.addValue("locationId", locationId);
        }
        if (hasSearch) {
            sql.append("""
                     AND (
                        LOWER(um.employeeid)   LIKE :q
                     OR LOWER(um.fullName)     LIKE :q
                     OR LOWER(um.department)   LIKE :q
                     OR LOWER(um.worklocation) LIKE :q
                    )
                    """);
            params.addValue("q", "%" + search.trim().toLowerCase() + "%");
        }
        Long count = namedParameterJdbcTemplate.queryForObject(sql.toString(), params, Long.class);
        return count == null ? 0L : count;
    }

    /**
     * Returns one page of ManagedUserDtos, optionally filtered by search term and/or locationId.
     *
     * @param search     case-insensitive substring across id / name / ip / mac
     * @param locationId LocationId FK; null = all locations
     * @param offset     SQL OFFSET
     * @param limit      SQL LIMIT
     */
    public List<ManagedUserDto> findManagedUsersPaged(String search, String locationId, int offset, int limit) {
        boolean hasSearch   = search     != null && !search.isBlank();
        boolean hasLocation = locationId != null && !locationId.isBlank();
        String like = hasSearch ? "%" + search.trim().toLowerCase() + "%" : null;

        StringBuilder sql = new StringBuilder("""
                SELECT um.employeeid,
                       um.fullName,
                       COALESCE(lm.descriptiveName, um.location) AS location,
                       um.ipaddress,
                       um.macaddress,
                       um.status
                FROM usermanagement um
                LEFT JOIN locationmaster lm ON um.location = lm.LocationId
                WHERE 1=1
                """);

        MapSqlParameterSource params = new MapSqlParameterSource();
        if (hasLocation) {
            sql.append(" AND um.location = :locationId");
            params.addValue("locationId", locationId);
        }
        if (hasSearch) {
            sql.append("""
                     AND (
                        LOWER(um.employeeid) LIKE :q
                     OR LOWER(um.fullName)   LIKE :q
                     OR LOWER(um.ipaddress)  LIKE :q
                     OR LOWER(um.macaddress) LIKE :q
                    )
                    """);
            params.addValue("q", like);
        }

        sql.append("ORDER BY um.fullName\nLIMIT :limit OFFSET :offset");
        params.addValue("limit", limit).addValue("offset", offset);

        return namedParameterJdbcTemplate.query(sql.toString(), params, (rs, rowNum) ->
                ManagedUserDto.builder()
                        .id(rs.getString("employeeid"))
                        .name(rs.getString("fullName"))
                        .location(rs.getString("location"))
                        .ipAddress(rs.getString("ipaddress"))
                        .macAddress(rs.getString("macaddress"))
                        .status("ACTIVE".equalsIgnoreCase(rs.getString("status")))
                        .build()
        );
    }

    /** Total count of managed users matching the same optional search and location. */
    public long countManagedUsers(String search, String locationId) {
        boolean hasSearch   = search     != null && !search.isBlank();
        boolean hasLocation = locationId != null && !locationId.isBlank();
        MapSqlParameterSource params = new MapSqlParameterSource();
        StringBuilder sql = new StringBuilder("SELECT COUNT(*) FROM usermanagement um WHERE 1=1 ");
        if (hasLocation) {
            sql.append(" AND um.location = :locationId");
            params.addValue("locationId", locationId);
        }
        if (hasSearch) {
            sql.append("""
                     AND (
                        LOWER(um.employeeid) LIKE :q
                     OR LOWER(um.fullName)   LIKE :q
                     OR LOWER(um.ipaddress)  LIKE :q
                     OR LOWER(um.macaddress) LIKE :q
                    )
                    """);
            params.addValue("q", "%" + search.trim().toLowerCase() + "%");
        }
        Long count = namedParameterJdbcTemplate.queryForObject(sql.toString(), params, Long.class);
        return count == null ? 0L : count;
    }

    public boolean existsInUserMaster(String employeeId) {
        String sql = "SELECT COUNT(*) FROM usermaster WHERE employeeid = :employeeId";
        MapSqlParameterSource params = new MapSqlParameterSource("employeeId", employeeId);
        Integer count = namedParameterJdbcTemplate.queryForObject(sql, params, Integer.class);
        return count != null && count > 0;
    }

    public void insertUserMaster(String employeeId, String fullName, String workemail,
                                  String phone, String designation, String worklocation,
                                  String department, String role) {
        String sql = """
                INSERT INTO usermaster (employeeid, fullName, workemail, phone, designation, worklocation, department, role, createdBy)
                VALUES (:employeeId, :fullName, :workemail, :phone, :designation, :worklocation, :department, :role, 'SYSTEM')
                """;
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("employeeId", employeeId)
                .addValue("fullName", fullName)
                .addValue("workemail", workemail)
                .addValue("phone", phone)
                .addValue("designation", designation)
                .addValue("worklocation", worklocation)
                .addValue("department", department)
                .addValue("role", role);
        namedParameterJdbcTemplate.update(sql, params);
    }

    // ── Search / Lookup ───────────────────────────────────────────────────────

    /**
     * Searches usermaster by employeeid OR fullName using a case-insensitive LIKE.
     * When {@code locationId} is supplied, results are restricted to employees at that location.
     * Returns up to 20 matches ordered by employeeid.
     *
     * Used by: GET /api/managed-users/search?q=
     */
    public List<UserLookupDto> searchUserMaster(String query, String locationId) {
        boolean hasLocation = locationId != null && !locationId.isBlank();
        String like = "%" + query.trim().toLowerCase() + "%";

        StringBuilder sql = new StringBuilder("""
                SELECT um.employeeid, um.fullName, um.worklocation, um.designation,
                       um.department, um.workemail, um.phone
                FROM usermaster um
                LEFT JOIN locationmaster lm
                       ON LOWER(TRIM(um.worklocation)) = LOWER(TRIM(lm.descriptiveName))
                WHERE (LOWER(um.employeeid) LIKE :like OR LOWER(um.fullName) LIKE :like)
                """);
        MapSqlParameterSource params = new MapSqlParameterSource("like", like);
        if (hasLocation) {
            sql.append(" AND lm.LocationId = :locationId");
            params.addValue("locationId", locationId);
        }
        sql.append(" ORDER BY um.employeeid LIMIT 20");

        return namedParameterJdbcTemplate.query(sql.toString(), params,
                (rs, rowNum) -> UserLookupDto.builder()
                        .id(rs.getString("employeeid"))
                        .name(rs.getString("fullName"))
                        .location(rs.getString("worklocation"))
                        .designation(rs.getString("designation"))
                        .department(rs.getString("department"))
                        .email(rs.getString("workemail"))
                        .phone(rs.getString("phone"))
                        .build()
        );
    }

    // ── Managed Users (usermanagement CRUD) ──────────────────────────────────

    /**
     * Returns all rows from usermanagement joined with locationmaster
     * to resolve the FK into a human-readable location name.
     */
    public List<ManagedUserDto> findAllManagedUsers() {
        String sql = """
                SELECT um.employeeid,
                       um.fullName,
                       COALESCE(lm.descriptiveName, um.location) AS location,
                       um.ipaddress,
                       um.macaddress,
                       um.status
                FROM usermanagement um
                LEFT JOIN locationmaster lm ON um.location = lm.LocationId
                ORDER BY um.fullName
                """;
        return namedParameterJdbcTemplate.query(sql, new MapSqlParameterSource(),
                (rs, rowNum) -> ManagedUserDto.builder()
                        .id(rs.getString("employeeid"))
                        .name(rs.getString("fullName"))
                        .location(rs.getString("location"))
                        .ipAddress(rs.getString("ipaddress"))
                        .macAddress(rs.getString("macaddress"))
                        .status("ACTIVE".equalsIgnoreCase(rs.getString("status")))
                        .build()
        );
    }

    /**
     * Returns a single managed user by employeeId, with location resolved to descriptiveName.
     */
    public Optional<ManagedUserDto> findManagedUserById(String employeeId) {
        String sql = """
                SELECT um.employeeid,
                       um.fullName,
                       COALESCE(lm.descriptiveName, um.location) AS location,
                       um.ipaddress,
                       um.macaddress,
                       um.status
                FROM usermanagement um
                LEFT JOIN locationmaster lm ON um.location = lm.LocationId
                WHERE um.employeeid = :employeeId
                """;
        List<ManagedUserDto> results = namedParameterJdbcTemplate.query(
                sql, new MapSqlParameterSource("employeeId", employeeId),
                (rs, rowNum) -> ManagedUserDto.builder()
                        .id(rs.getString("employeeid"))
                        .name(rs.getString("fullName"))
                        .location(rs.getString("location"))
                        .ipAddress(rs.getString("ipaddress"))
                        .macAddress(rs.getString("macaddress"))
                        .status("ACTIVE".equalsIgnoreCase(rs.getString("status")))
                        .build()
        );
        return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
    }

    /**
     * Resolves a location name or code to a LocationId (PK in locationmaster).
     * Tries exact match on LocationId first, then descriptiveName.
     */
    public Optional<String> findLocationIdByNameOrCode(String nameOrCode) {
        String sql = """
                SELECT LocationId FROM locationmaster
                WHERE LocationId = :val OR descriptiveName = :val
                LIMIT 1
                """;
        try {
            String id = namedParameterJdbcTemplate.queryForObject(
                    sql, new MapSqlParameterSource("val", nameOrCode), String.class);
            return Optional.ofNullable(id);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    /**
     * Updates only the BCrypt-encoded password of an existing usermanagement record.
     * Called when the admin explicitly changes a user's password via the Edit User form.
     */
    public void updatePassword(String employeeId, String encodedPassword) {
        String sql = """
                UPDATE usermanagement
                SET password = :password, modifiedBy = 'APP'
                WHERE employeeid = :employeeId
                """;
        namedParameterJdbcTemplate.update(sql, new MapSqlParameterSource()
                .addValue("employeeId", employeeId)
                .addValue("password",   encodedPassword)
        );
    }

    /**
     * Updates an existing usermanagement record (name, location FK, ip, mac, status).
     */
    public void updateUserManagement(String employeeId, String fullName, String locationId,
                                     String ipAddress, String macAddress, UserStatus status) {
        String sql = """
                UPDATE usermanagement
                SET fullName    = :fullName,
                    location    = :locationId,
                    ipaddress   = :ipAddress,
                    macaddress  = :macAddress,
                    status      = :status,
                    modifiedBy  = 'APP'
                WHERE employeeid = :employeeId
                """;
        namedParameterJdbcTemplate.update(sql, new MapSqlParameterSource()
                .addValue("employeeId",  employeeId)
                .addValue("fullName",    fullName)
                .addValue("locationId",  locationId)
                .addValue("ipAddress",   ipAddress)
                .addValue("macAddress",  macAddress)
                .addValue("status",      status.name())
        );
    }

    /**
     * Updates only the status of a usermanagement record.
     */
    public void updateUserManagementStatus(String employeeId, UserStatus status) {
        String sql = """
                UPDATE usermanagement
                SET status = :status, modifiedBy = 'APP'
                WHERE employeeid = :employeeId
                """;
        namedParameterJdbcTemplate.update(sql, new MapSqlParameterSource()
                .addValue("employeeId", employeeId)
                .addValue("status",     status.name())
        );
    }

    // ── LocationMaster ────────────────────────────────────────────────────────

    public Optional<String> findLocationName(String locationId) {
        String sql = "SELECT descriptiveName FROM locationmaster WHERE LocationId = :locationId";
        MapSqlParameterSource params = new MapSqlParameterSource("locationId", locationId);
        try {
            String name = namedParameterJdbcTemplate.queryForObject(sql, params, String.class);
            return Optional.ofNullable(name);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public boolean existsLocation(String locationId) {
        String sql = "SELECT COUNT(*) FROM locationmaster WHERE LocationId = :locationId";
        MapSqlParameterSource params = new MapSqlParameterSource("locationId", locationId);
        Integer count = namedParameterJdbcTemplate.queryForObject(sql, params, Integer.class);
        return count != null && count > 0;
    }

    public void insertLocation(String locationId, String descriptiveName, String type,
                                String address, String city, String state, String pincode,
                                String status, String createdBy) {
        String sql = """
                INSERT INTO locationmaster (LocationId, descriptiveName, type, address, city, state, pincode, status, createdBy)
                VALUES (:locationId, :descriptiveName, :type, :address, :city, :state, :pincode, :status, :createdBy)
                """;
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("locationId", locationId)
                .addValue("descriptiveName", descriptiveName)
                .addValue("type", type)
                .addValue("address", address)
                .addValue("city", city)
                .addValue("state", state)
                .addValue("pincode", pincode)
                .addValue("status", status)
                .addValue("createdBy", createdBy);
        namedParameterJdbcTemplate.update(sql, params);
    }
}
