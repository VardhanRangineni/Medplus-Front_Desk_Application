package com.medplus.frontdesk_backend.repository;

import com.medplus.frontdesk_backend.dto.external.ExternalEmployeeDto;
import com.medplus.frontdesk_backend.dto.external.ExternalLocationDto;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class SyncRepository {

    private final NamedParameterJdbcTemplate jdbc;

    // ── Location ──────────────────────────────────────────────────────────────

    public boolean locationExists(String locationId) {
        String sql = "SELECT COUNT(*) FROM locationmaster WHERE LocationId = :id";
        Integer count = jdbc.queryForObject(sql,
                new MapSqlParameterSource("id", locationId), Integer.class);
        return count != null && count > 0;
    }

    /**
     * INSERT if new, UPDATE only the external-API-owned fields if existing.
     * status is NEVER touched on update — it is managed by this application only.
     */
    public void upsertLocation(ExternalLocationDto loc) {
        String sql = """
                INSERT INTO locationmaster
                    (LocationId, descriptiveName, type, coordinates, address, city, state, pincode, status, createdBy)
                VALUES
                    (:locationId, :descriptiveName, :type, :coordinates, :address, :city, :state, :pincode,
                     'NOTCONFIGURED', 'SYNC')
                ON DUPLICATE KEY UPDATE
                    descriptiveName = VALUES(descriptiveName),
                    type            = VALUES(type),
                    coordinates     = VALUES(coordinates),
                    address         = VALUES(address),
                    city            = VALUES(city),
                    state           = VALUES(state),
                    pincode         = VALUES(pincode),
                    modifiedBy      = 'SYNC'
                """;

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("locationId",      loc.getLocationId())
                .addValue("descriptiveName", loc.getDescriptiveName())
                .addValue("type",            loc.getType())
                .addValue("coordinates",     loc.getCoordinates())
                .addValue("address",         loc.getAddress())
                .addValue("city",            loc.getCity())
                .addValue("state",           loc.getState())
                .addValue("pincode",         loc.getPincode());

        jdbc.update(sql, params);
    }

    // ── UserMaster ────────────────────────────────────────────────────────────

    public boolean userMasterExists(String employeeId) {
        String sql = "SELECT COUNT(*) FROM usermaster WHERE employeeid = :id";
        Integer count = jdbc.queryForObject(sql,
                new MapSqlParameterSource("id", employeeId), Integer.class);
        return count != null && count > 0;
    }

    /**
     * INSERT if new, UPDATE only the external-API-owned fields if existing.
     * createdBy / createdAt are never changed after the first insert.
     */
    public void upsertUserMaster(ExternalEmployeeDto emp) {
        String sql = """
                INSERT INTO usermaster
                    (employeeid, fullName, workemail, phone, designation, worklocation, department, role, createdBy)
                VALUES
                    (:employeeId, :fullName, :workemail, :phone, :designation, :worklocation, :department, :role, 'SYNC')
                ON DUPLICATE KEY UPDATE
                    fullName     = VALUES(fullName),
                    workemail    = VALUES(workemail),
                    phone        = VALUES(phone),
                    designation  = VALUES(designation),
                    worklocation = VALUES(worklocation),
                    department   = VALUES(department),
                    role         = VALUES(role),
                    modifiedBy   = 'SYNC'
                """;

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("employeeId",   emp.getEmployeeId())
                .addValue("fullName",     emp.getFullName())
                .addValue("workemail",    emp.getWorkEmail())
                .addValue("phone",        emp.getPhone())
                .addValue("designation",  emp.getDesignation())
                .addValue("worklocation", emp.getWorkLocation())
                .addValue("department",   emp.getDepartment())
                .addValue("role",         emp.getRole());

        jdbc.update(sql, params);
    }
}
