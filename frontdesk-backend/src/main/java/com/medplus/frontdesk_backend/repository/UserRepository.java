package com.medplus.frontdesk_backend.repository;

import com.medplus.frontdesk_backend.dto.ManagedUserDto;
import com.medplus.frontdesk_backend.dto.RoleDto;
import com.medplus.frontdesk_backend.dto.UserLookupDto;
import com.medplus.frontdesk_backend.model.UserManagement;
import com.medplus.frontdesk_backend.model.UserRole;
import com.medplus.frontdesk_backend.model.UserStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Repository
@RequiredArgsConstructor
public class UserRepository {

    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;

    // ── UserManagement ────────────────────────────────────────────────────────

    public Optional<UserManagement> findByEmployeeId(String employeeId) {
        String sql = """
                SELECT um.employeeid, um.fullName, um.password,
                       um.location, um.status, um.assignedDeviceId,
                       um.loginEnabled, um.createdBy,
                       r.code AS roleCode
                FROM usermanagement um
                JOIN roles r ON um.roleId = r.id
                WHERE um.employeeid = :employeeId
                """;
        MapSqlParameterSource params = new MapSqlParameterSource("employeeId", employeeId);

        List<UserManagement> results = namedParameterJdbcTemplate.query(sql, params,
                (rs, rowNum) -> UserManagement.builder()
                        .employeeid(rs.getString("employeeid"))
                        .fullName(rs.getString("fullName"))
                        .password(rs.getString("password"))
                        .location(rs.getString("location"))
                        .status(UserStatus.valueOf(rs.getString("status")))
                        .role(mapRoleCodeToUserRole(rs.getString("roleCode")))
                        .assignedDeviceId(rs.getString("assignedDeviceId"))
                        .loginEnabled(rs.getBoolean("loginEnabled"))
                        .createdBy(rs.getString("createdBy"))
                        .build()
        );

        if (results.isEmpty()) {
            return Optional.empty();
        }
        UserManagement user = results.get(0);
        user.setRoles(findRolesByEmployeeId(employeeId));
        return Optional.of(user);
    }

    /** All roles assigned to the user (mapping table, with primary-role fallback). */
    public List<UserRole> findRolesByEmployeeId(String employeeId) {
        String sql = """
                SELECT r.code
                FROM user_role_mapping urm
                JOIN roles r ON urm.roleId = r.id
                WHERE urm.employeeId = :employeeId
                ORDER BY r.id
                """;
        List<UserRole> mapped = namedParameterJdbcTemplate.query(
                sql,
                new MapSqlParameterSource("employeeId", employeeId),
                (rs, rowNum) -> mapRoleCodeToUserRole(rs.getString("code"))
        );
        if (!mapped.isEmpty()) {
            return mapped;
        }
        return findByEmployeeIdPrimaryRoleOnly(employeeId)
                .map(List::of)
                .orElse(List.of(UserRole.RECEPTIONIST));
    }

    private Optional<UserRole> findByEmployeeIdPrimaryRoleOnly(String employeeId) {
        String sql = """
                SELECT r.code AS roleCode
                FROM usermanagement um
                JOIN roles r ON um.roleId = r.id
                WHERE um.employeeid = :employeeId
                """;
        List<UserRole> roles = namedParameterJdbcTemplate.query(
                sql,
                new MapSqlParameterSource("employeeId", employeeId),
                (rs, rowNum) -> mapRoleCodeToUserRole(rs.getString("roleCode"))
        );
        return roles.isEmpty() ? Optional.empty() : Optional.of(roles.get(0));
    }

    public boolean hasRole(String employeeId, int roleId) {
        Integer count = namedParameterJdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM user_role_mapping
                WHERE employeeId = :employeeId AND roleId = :roleId
                """,
                new MapSqlParameterSource()
                        .addValue("employeeId", employeeId)
                        .addValue("roleId", roleId),
                Integer.class);
        if (count != null && count > 0) {
            return true;
        }
        Integer primary = namedParameterJdbcTemplate.queryForObject(
                "SELECT roleId FROM usermanagement WHERE employeeid = :employeeId",
                new MapSqlParameterSource("employeeId", employeeId),
                Integer.class);
        return primary != null && primary == roleId;
    }

    public Map<String, List<Integer>> findRoleIdsByEmployeeIds(Collection<String> employeeIds) {
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
        String sql = """
                SELECT urm.employeeId, urm.roleId
                FROM user_role_mapping urm
                WHERE urm.employeeId IN (:ids)
                ORDER BY urm.roleId
                """;
        Map<String, List<Integer>> out = new HashMap<>();
        namedParameterJdbcTemplate.query(
                sql,
                new MapSqlParameterSource("ids", ids),
                rs -> {
                    while (rs.next()) {
                        String id = rs.getString("employeeId");
                        int roleId = rs.getInt("roleId");
                        out.computeIfAbsent(id, k -> new java.util.ArrayList<>()).add(roleId);
                    }
                    return null;
                });
        for (String id : ids) {
            out.computeIfAbsent(id, k -> {
                Integer primary = namedParameterJdbcTemplate.queryForObject(
                        "SELECT roleId FROM usermanagement WHERE employeeid = :id",
                        new MapSqlParameterSource("id", id),
                        Integer.class);
                return primary != null ? List.of(primary) : List.of(3);
            });
        }
        return out;
    }

    public List<Integer> findRoleIdsByEmployeeId(String employeeId) {
        return findRoleIdsByEmployeeIds(List.of(employeeId)).getOrDefault(employeeId, List.of(3));
    }

    public void replaceUserRoles(String employeeId, List<Integer> roleIds) {
        Set<Integer> distinct = roleIds == null ? Set.of() : roleIds.stream()
                .filter(id -> id != null && id > 0)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (distinct.isEmpty()) {
            distinct = Set.of(3);
        }
        namedParameterJdbcTemplate.update(
                "DELETE FROM user_role_mapping WHERE employeeId = :employeeId",
                new MapSqlParameterSource("employeeId", employeeId));
        for (Integer roleId : distinct) {
            namedParameterJdbcTemplate.update(
                    "INSERT INTO user_role_mapping (employeeId, roleId) VALUES (:employeeId, :roleId)",
                    new MapSqlParameterSource()
                            .addValue("employeeId", employeeId)
                            .addValue("roleId", roleId));
        }
    }

    public String formatRoleNames(List<Integer> roleIds) {
        if (roleIds == null || roleIds.isEmpty()) {
            return "";
        }
        String sql = "SELECT displayName FROM roles WHERE id IN (:ids) ORDER BY id";
        List<String> names = namedParameterJdbcTemplate.query(
                sql,
                new MapSqlParameterSource("ids", roleIds),
                (rs, rowNum) -> rs.getString("displayName"));
        return String.join(", ", names);
    }

    /** Assigned location IDs for a user (multi-location supervisors). */
    public List<String> findLocationIdsByEmployeeId(String employeeId) {
        String sql = """
                SELECT locationId FROM user_location_mapping
                WHERE employeeId = :employeeId
                ORDER BY locationId
                """;
        List<String> mapped = namedParameterJdbcTemplate.query(
                sql,
                new MapSqlParameterSource("employeeId", employeeId),
                (rs, rowNum) -> rs.getString("locationId"));
        if (!mapped.isEmpty()) {
            return mapped;
        }
        // Legacy fallback: single profile location column
        try {
            String profile = namedParameterJdbcTemplate.queryForObject(
                    "SELECT location FROM usermanagement WHERE employeeid = :id",
                    new MapSqlParameterSource("id", employeeId),
                    String.class);
            if (profile != null && !profile.isBlank()) {
                return List.of(profile.trim());
            }
        } catch (EmptyResultDataAccessException ignored) {
            // no row
        }
        return List.of();
    }

    public Map<String, List<String>> findLocationIdsByEmployeeIds(Collection<String> employeeIds) {
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
        Map<String, List<String>> out = new HashMap<>();
        namedParameterJdbcTemplate.query(
                """
                SELECT employeeId, locationId FROM user_location_mapping
                WHERE employeeId IN (:ids)
                ORDER BY locationId
                """,
                new MapSqlParameterSource("ids", ids),
                rs -> {
                    while (rs.next()) {
                        out.computeIfAbsent(rs.getString("employeeId"), k -> new java.util.ArrayList<>())
                                .add(rs.getString("locationId"));
                    }
                    return null;
                });
        for (String id : ids) {
            out.computeIfAbsent(id, this::findLocationIdsByEmployeeId);
        }
        return out;
    }

    public void replaceUserLocations(String employeeId, List<String> locationIds) {
        namedParameterJdbcTemplate.update(
                "DELETE FROM user_location_mapping WHERE employeeId = :employeeId",
                new MapSqlParameterSource("employeeId", employeeId));
        if (locationIds == null) {
            return;
        }
        Set<String> distinct = locationIds.stream()
                .filter(id -> id != null && !id.isBlank())
                .map(String::trim)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        for (String locationId : distinct) {
            namedParameterJdbcTemplate.update(
                    "INSERT INTO user_location_mapping (employeeId, locationId) VALUES (:employeeId, :locationId)",
                    new MapSqlParameterSource()
                            .addValue("employeeId", employeeId)
                            .addValue("locationId", locationId));
        }
    }

    public boolean hasLocationAccess(String employeeId, String locationId) {
        if (employeeId == null || locationId == null || locationId.isBlank()) {
            return false;
        }
        return findLocationIdsByEmployeeId(employeeId).stream()
                .anyMatch(id -> id.equalsIgnoreCase(locationId.trim()));
    }

    public String formatLocationNames(List<String> locationIds) {
        if (locationIds == null || locationIds.isEmpty()) {
            return "";
        }
        List<String> names = new java.util.ArrayList<>();
        for (String id : locationIds) {
            names.add(findLocationName(id).orElse(id));
        }
        return String.join(", ", names);
    }

    /** Maps the {@code roles.code} value to the internal {@link UserRole} enum used by Spring Security. */
    private static UserRole mapRoleCodeToUserRole(String code) {
        if (code == null) return UserRole.RECEPTIONIST;
        return switch (code) {
            case "ADMIN"       -> UserRole.PRIMARY_ADMIN;
            case "SUPERVISOR"  -> UserRole.REGIONAL_ADMIN;
            default            -> UserRole.RECEPTIONIST;
        };
    }

    public boolean existsInUserManagement(String employeeId) {
        String sql = "SELECT COUNT(*) FROM usermanagement WHERE employeeid = :employeeId";
        MapSqlParameterSource params = new MapSqlParameterSource("employeeId", employeeId);
        Integer count = namedParameterJdbcTemplate.queryForObject(sql, params, Integer.class);
        return count != null && count > 0;
    }

    public void insertUserManagement(String employeeId, String fullName, String workemail, String phone,
                                     String designation, String department, String encodedPassword,
                                     String locationCode, String locationName, UserStatus status, int roleId,
                                     String assignedDeviceId, boolean loginEnabled, String createdBy) {
        String sql = """
                INSERT INTO usermanagement
                    (employeeid, fullName, workemail, phone, designation, department,
                     password, location, locationName, assignedDeviceId,
                     loginEnabled, status, roleId, createdBy)
                VALUES (:employeeId, :fullName, :workemail, :phone, :designation, :department,
                        :password, :location, :locationName, :assignedDeviceId,
                        :loginEnabled, :status, :roleId, :createdBy)
                """;
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("employeeId", employeeId)
                .addValue("fullName", fullName)
                .addValue("workemail", workemail != null ? workemail : "")
                .addValue("phone", phone != null ? phone : "")
                .addValue("designation", designation != null ? designation : "Employee")
                .addValue("department", department != null ? department : "General")
                .addValue("password", encodedPassword)
                .addValue("location", locationCode != null ? locationCode : "")
                .addValue("locationName", locationName != null ? locationName : "")
                .addValue("assignedDeviceId", assignedDeviceId)
                .addValue("loginEnabled", loginEnabled ? 1 : 0)
                .addValue("status", status.name())
                .addValue("roleId", roleId)
                .addValue("createdBy", createdBy != null && !createdBy.isBlank() ? createdBy : "SYSTEM");
        namedParameterJdbcTemplate.update(sql, params);
    }

    // ── Roles ─────────────────────────────────────────────────────────────────

    /** Returns all rows from the {@code roles} reference table, ordered by id. */
    public List<RoleDto> findAllRoles() {
        return namedParameterJdbcTemplate.query(
                "SELECT id, code, displayName, description FROM roles ORDER BY id",
                new MapSqlParameterSource(),
                (rs, rowNum) -> RoleDto.builder()
                        .id(rs.getInt("id"))
                        .code(rs.getString("code"))
                        .displayName(rs.getString("displayName"))
                        .description(rs.getString("description"))
                        .build()
        );
    }

    /**
     * Batch-loads phones from {@code usermanagement} for the given employee IDs.
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
        String sql = "SELECT employeeid, phone FROM usermanagement WHERE employeeid IN (:ids)";
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
     * Returns one page of ManagedUserDtos, optionally filtered by search term and/or locationId.
     *
     * @param search     case-insensitive substring across id / name / ip / mac
     * @param locationId LocationId FK; null = all locations
     * @param offset     SQL OFFSET
     * @param limit      SQL LIMIT
     */
    public List<ManagedUserDto> findManagedUsersPaged(String search, String locationId,
                                                      String createdByEmployerId, int offset, int limit) {
        boolean hasSearch   = search     != null && !search.isBlank();
        boolean hasLocation = locationId != null && !locationId.isBlank();
        boolean hasCreator  = createdByEmployerId != null && !createdByEmployerId.isBlank();
        String like = hasSearch ? "%" + search.trim().toLowerCase() + "%" : null;

        StringBuilder sql = new StringBuilder("""
                SELECT um.employeeid,
                       um.fullName,
                       COALESCE(NULLIF(um.locationName, ''), um.location) AS location,
                       um.assignedDeviceId,
                       dm.displayName AS assignedDeviceName,
                       um.status,
                       um.roleId,
                       um.createdBy,
                       r.displayName AS roleName
                FROM usermanagement um
                JOIN  roles             r  ON um.roleId   = r.id
                LEFT JOIN device_master   dm ON um.assignedDeviceId = dm.deviceId
                WHERE 1=1
                """);

        MapSqlParameterSource params = new MapSqlParameterSource();
        if (hasLocation) {
            sql.append(" AND um.location = :locationId");
            params.addValue("locationId", locationId);
        }
        if (hasCreator) {
            sql.append(" AND LOWER(um.createdBy) = LOWER(:createdBy)");
            params.addValue("createdBy", createdByEmployerId.trim());
        }
        if (hasSearch) {
            sql.append("""
                     AND (
                        LOWER(um.employeeid) LIKE :q
                     OR LOWER(um.fullName)   LIKE :q
                    )
                    """);
            params.addValue("q", like);
        }

        sql.append(" ORDER BY um.fullName\nLIMIT :limit OFFSET :offset");
        params.addValue("limit", limit).addValue("offset", offset);

        return namedParameterJdbcTemplate.query(sql.toString(), params, UserRepository::mapManagedUserDto);
    }

    private static ManagedUserDto mapManagedUserDto(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
        return ManagedUserDto.builder()
                .id(rs.getString("employeeid"))
                .name(rs.getString("fullName"))
                .location(rs.getString("location"))
                .assignedDeviceId(rs.getString("assignedDeviceId"))
                .assignedDeviceName(rs.getString("assignedDeviceName"))
                .status("ACTIVE".equalsIgnoreCase(rs.getString("status")))
                .roleId(rs.getInt("roleId"))
                .roleName(rs.getString("roleName"))
                .createdBy(rs.getString("createdBy"))
                .build();
    }

    /** Total count of managed users matching the same optional search and location. */
    public long countManagedUsers(String search, String locationId, String createdByEmployerId) {
        boolean hasSearch   = search     != null && !search.isBlank();
        boolean hasLocation = locationId != null && !locationId.isBlank();
        boolean hasCreator  = createdByEmployerId != null && !createdByEmployerId.isBlank();
        MapSqlParameterSource params = new MapSqlParameterSource();
        StringBuilder sql = new StringBuilder("SELECT COUNT(*) FROM usermanagement um WHERE 1=1 ");
        if (hasLocation) {
            sql.append(" AND um.location = :locationId");
            params.addValue("locationId", locationId);
        }
        if (hasCreator) {
            sql.append(" AND LOWER(um.createdBy) = LOWER(:createdBy)");
            params.addValue("createdBy", createdByEmployerId.trim());
        }
        if (hasSearch) {
            sql.append("""
                     AND (
                        LOWER(um.employeeid) LIKE :q
                     OR LOWER(um.fullName)   LIKE :q
                    )
                    """);
            params.addValue("q", "%" + search.trim().toLowerCase() + "%");
        }
        Long count = namedParameterJdbcTemplate.queryForObject(sql.toString(), params, Long.class);
        return count == null ? 0L : count;
    }

    /**
     * Type-ahead search over usermanagement (employee directory + logins).
     */
    public List<UserLookupDto> searchDirectoryUsers(String query, String locationId, String createdByEmployerId) {
        boolean hasLocation = locationId != null && !locationId.isBlank();
        boolean hasCreator  = createdByEmployerId != null && !createdByEmployerId.isBlank();
        String like = "%" + query.trim().toLowerCase() + "%";

        StringBuilder sql = new StringBuilder("""
                SELECT um.employeeid, um.fullName,
                       COALESCE(NULLIF(um.locationName, ''), um.location) AS worklocation,
                       um.designation, um.department, um.workemail, um.phone,
                       um.roleId, r.displayName AS roleName
                FROM usermanagement um
                JOIN roles r ON r.id = um.roleId
                WHERE (LOWER(um.employeeid) LIKE :like OR LOWER(um.fullName) LIKE :like)
                """);
        MapSqlParameterSource params = new MapSqlParameterSource("like", like);
        if (hasLocation) {
            sql.append(" AND um.location = :locationId");
            params.addValue("locationId", locationId);
        }
        if (hasCreator) {
            sql.append(" AND LOWER(um.createdBy) = LOWER(:createdBy)");
            params.addValue("createdBy", createdByEmployerId.trim());
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
                        .roleId(rs.getObject("roleId") != null ? rs.getInt("roleId") : null)
                        .roleName(rs.getString("roleName"))
                        .build()
        );
    }

    // ── Managed Users (usermanagement CRUD) ──────────────────────────────────

    /**
     * Returns a single managed user by employeeId, with location and role resolved.
     */
    public Optional<ManagedUserDto> findManagedUserById(String employeeId) {
        String sql = """
                SELECT um.employeeid,
                       um.fullName,
                       COALESCE(NULLIF(um.locationName, ''), um.location) AS location,
                       um.assignedDeviceId,
                       dm.displayName AS assignedDeviceName,
                       um.status,
                       um.roleId,
                       um.createdBy,
                       r.displayName AS roleName
                FROM usermanagement um
                JOIN  roles             r  ON um.roleId     = r.id
                LEFT JOIN device_master   dm ON um.assignedDeviceId = dm.deviceId
                WHERE um.employeeid = :employeeId
                """;
        List<ManagedUserDto> results = namedParameterJdbcTemplate.query(
                sql, new MapSqlParameterSource("employeeId", employeeId),
                UserRepository::mapManagedUserDto
        );
        return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
    }

    /**
     * Resolves a location name or code to a LocationId (PK in locationmaster).
     * Tries exact match on LocationId first, then descriptiveName.
     */
    public Optional<String> findLocationIdByNameOrCode(String nameOrCode) {
        String val = nameOrCode.trim();
        String sql = """
                SELECT code FROM (
                    SELECT locationId AS code, 1 AS prio
                    FROM location_master
                    WHERE locationId = :val OR descriptiveName = :val
                    UNION ALL
                    SELECT location AS code, 2 AS prio
                    FROM usermanagement
                    WHERE location = :val OR locationName = :val
                ) AS sources
                ORDER BY prio
                LIMIT 1
                """;
        try {
            String id = namedParameterJdbcTemplate.queryForObject(
                    sql, new MapSqlParameterSource("val", val), String.class);
            return Optional.ofNullable(id);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    /**
     * Updates only the BCrypt-encoded password of an existing usermanagement record.
     * Called when the admin explicitly changes a user's password via the Edit User form.
     */
    public void updatePassword(String employeeId, String encodedPassword, String modifiedBy) {
        String sql = """
                UPDATE usermanagement
                SET password = :password, modifiedBy = :modifiedBy
                WHERE employeeid = :employeeId
                """;
        namedParameterJdbcTemplate.update(sql, new MapSqlParameterSource()
                .addValue("employeeId", employeeId)
                .addValue("password",   encodedPassword)
                .addValue("modifiedBy", actorId(modifiedBy))
        );
    }

    /**
     * Updates an existing usermanagement record (name, location FK, ip, mac, status, roleId).
     */
    public void updateUserManagement(String employeeId, String fullName, String locationCode,
                                     String locationName, String assignedDeviceId,
                                     UserStatus status, int roleId, String modifiedBy) {
        String sql = """
                UPDATE usermanagement
                SET fullName     = :fullName,
                    location     = :locationCode,
                    locationName = :locationName,
                    assignedDeviceId = :assignedDeviceId,
                    status       = :status,
                    roleId       = :roleId,
                    modifiedBy   = :modifiedBy
                WHERE employeeid = :employeeId
                """;
        namedParameterJdbcTemplate.update(sql, new MapSqlParameterSource()
                .addValue("employeeId",   employeeId)
                .addValue("fullName",     fullName)
                .addValue("locationCode", locationCode != null ? locationCode : "")
                .addValue("locationName", locationName != null ? locationName : "")
                .addValue("assignedDeviceId", assignedDeviceId)
                .addValue("status",       status.name())
                .addValue("roleId",       roleId)
                .addValue("modifiedBy",   actorId(modifiedBy))
        );
    }

    /**
     * Updates only the status of a usermanagement record.
     */
    public void updateUserManagementStatus(String employeeId, UserStatus status, String modifiedBy) {
        String sql = """
                UPDATE usermanagement
                SET status = :status, modifiedBy = :modifiedBy
                WHERE employeeid = :employeeId
                """;
        namedParameterJdbcTemplate.update(sql, new MapSqlParameterSource()
                .addValue("employeeId", employeeId)
                .addValue("status",     status.name())
                .addValue("modifiedBy", actorId(modifiedBy))
        );
    }

    /** Prefer caller employee id; fall back only when actor unknown. */
    private static String actorId(String modifiedBy) {
        if (modifiedBy != null && !modifiedBy.isBlank()) {
            return modifiedBy.trim();
        }
        return "SYSTEM";
    }

    public Optional<String> findLocationName(String locationCode) {
        String sql = """
                SELECT name FROM (
                    SELECT descriptiveName AS name, 1 AS prio
                    FROM location_master WHERE locationId = :locationCode
                    UNION ALL
                    SELECT COALESCE(NULLIF(locationName, ''), location) AS name, 2 AS prio
                    FROM usermanagement WHERE location = :locationCode
                ) AS sources
                ORDER BY prio
                LIMIT 1
                """;
        try {
            String name = namedParameterJdbcTemplate.queryForObject(
                    sql, new MapSqlParameterSource("locationCode", locationCode), String.class);
            return Optional.ofNullable(name);
        } catch (EmptyResultDataAccessException e) {
            return Optional.ofNullable(locationCode);
        }
    }
}
