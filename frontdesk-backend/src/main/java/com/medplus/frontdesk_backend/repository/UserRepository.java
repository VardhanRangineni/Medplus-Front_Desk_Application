package com.medplus.frontdesk_backend.repository;

import com.medplus.frontdesk_backend.dto.UserDto;
import com.medplus.frontdesk_backend.model.UserManagement;
import com.medplus.frontdesk_backend.model.UserMaster;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
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
                        .status(rs.getString("status"))
                        .role(rs.getString("role"))
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
                                     String locationId, String status, String role, String ipaddress) {
        String sql = """
                INSERT INTO usermanagement (employeeid, fullName, ipaddress, password, location, status, role)
                VALUES (:employeeId, :fullName, :ipaddress, :password, :location, :status, :role)
                """;
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("employeeId", employeeId)
                .addValue("fullName", fullName)
                .addValue("ipaddress", ipaddress)
                .addValue("password", encodedPassword)
                .addValue("location", locationId)
                .addValue("status", status)
                .addValue("role", role);
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
