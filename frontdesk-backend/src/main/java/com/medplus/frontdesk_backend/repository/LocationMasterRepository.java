package com.medplus.frontdesk_backend.repository;

import com.medplus.frontdesk_backend.dto.CityMasterDto;
import com.medplus.frontdesk_backend.dto.CompanyMasterDto;
import com.medplus.frontdesk_backend.dto.LocationListFilterDto;
import com.medplus.frontdesk_backend.dto.LocationMasterDto;
import com.medplus.frontdesk_backend.dto.LocationTypeMasterDto;
import com.medplus.frontdesk_backend.dto.StateMasterDto;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class LocationMasterRepository {

    private final NamedParameterJdbcTemplate jdbc;

    // ── companies ─────────────────────────────────────────────────────────────

    public List<CompanyMasterDto> findAllCompanies(boolean activeOnly) {
        String sql = """
                SELECT id, companyCode, companyName, status
                FROM company_master
                """ + (activeOnly ? " WHERE status = 'ACTIVE' " : "") + """
                ORDER BY companyName
                """;
        return jdbc.query(sql, new MapSqlParameterSource(), this::mapCompany);
    }

    public Optional<CompanyMasterDto> findCompanyById(long id) {
        String sql = "SELECT id, companyCode, companyName, status FROM company_master WHERE id = :id";
        List<CompanyMasterDto> rows = jdbc.query(sql, new MapSqlParameterSource("id", id), this::mapCompany);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    public long insertCompany(String code, String name, String createdBy) {
        String sql = """
                INSERT INTO company_master (companyCode, companyName, status, createdBy)
                VALUES (:code, :name, 'ACTIVE', :createdBy)
                """;
        KeyHolder keys = new GeneratedKeyHolder();
        jdbc.update(sql, new MapSqlParameterSource()
                .addValue("code", code)
                .addValue("name", name)
                .addValue("createdBy", createdBy), keys);
        return Objects.requireNonNull(keys.getKey()).longValue();
    }

    public void updateCompanyStatus(long id, boolean active, String modifiedBy) {
        String sql = """
                UPDATE company_master
                SET status = :status, modifiedBy = :modifiedBy
                WHERE id = :id
                """;
        jdbc.update(sql, new MapSqlParameterSource()
                .addValue("id", id)
                .addValue("status", active ? "ACTIVE" : "INACTIVE")
                .addValue("modifiedBy", modifiedBy));
    }

    public boolean companyCodeExists(String code) {
        String sql = "SELECT COUNT(*) FROM company_master WHERE companyCode = :code";
        Integer count = jdbc.queryForObject(sql, new MapSqlParameterSource("code", code), Integer.class);
        return count != null && count > 0;
    }

    public boolean companyNameExists(String name) {
        String sql = "SELECT COUNT(*) FROM company_master WHERE LOWER(companyName) = LOWER(:name)";
        Integer count = jdbc.queryForObject(sql, new MapSqlParameterSource("name", name.trim()), Integer.class);
        return count != null && count > 0;
    }

    // ── location types ────────────────────────────────────────────────────────

    public List<LocationTypeMasterDto> findAllLocationTypes(boolean activeOnly) {
        String sql = """
                SELECT id, typeCode, typeName, status
                FROM location_type_master
                """ + (activeOnly ? " WHERE status = 'ACTIVE' " : "") + """
                ORDER BY typeName
                """;
        return jdbc.query(sql, new MapSqlParameterSource(), this::mapLocationType);
    }

    public Optional<LocationTypeMasterDto> findLocationTypeById(long id) {
        String sql = "SELECT id, typeCode, typeName, status FROM location_type_master WHERE id = :id";
        List<LocationTypeMasterDto> rows = jdbc.query(sql, new MapSqlParameterSource("id", id), this::mapLocationType);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    public long insertLocationType(String code, String name, String createdBy) {
        String sql = """
                INSERT INTO location_type_master (typeCode, typeName, status, createdBy)
                VALUES (:code, :name, 'ACTIVE', :createdBy)
                """;
        KeyHolder keys = new GeneratedKeyHolder();
        jdbc.update(sql, new MapSqlParameterSource()
                .addValue("code", code)
                .addValue("name", name)
                .addValue("createdBy", createdBy), keys);
        return Objects.requireNonNull(keys.getKey()).longValue();
    }

    public void updateLocationTypeStatus(long id, boolean active, String modifiedBy) {
        String sql = """
                UPDATE location_type_master
                SET status = :status, modifiedBy = :modifiedBy
                WHERE id = :id
                """;
        jdbc.update(sql, new MapSqlParameterSource()
                .addValue("id", id)
                .addValue("status", active ? "ACTIVE" : "INACTIVE")
                .addValue("modifiedBy", modifiedBy));
    }

    public boolean locationTypeCodeExists(String code) {
        String sql = "SELECT COUNT(*) FROM location_type_master WHERE typeCode = :code";
        Integer count = jdbc.queryForObject(sql, new MapSqlParameterSource("code", code), Integer.class);
        return count != null && count > 0;
    }

    public boolean locationTypeNameExists(String name) {
        String sql = "SELECT COUNT(*) FROM location_type_master WHERE LOWER(typeName) = LOWER(:name)";
        Integer count = jdbc.queryForObject(sql, new MapSqlParameterSource("name", name.trim()), Integer.class);
        return count != null && count > 0;
    }

    // ── states ────────────────────────────────────────────────────────────────

    public List<StateMasterDto> findAllStates(boolean activeOnly) {
        String sql = """
                SELECT id, stateCode, stateName, status
                FROM state_master
                """ + (activeOnly ? " WHERE status = 'ACTIVE' " : "") + """
                ORDER BY stateName
                """;
        return jdbc.query(sql, new MapSqlParameterSource(), this::mapState);
    }

    public Optional<StateMasterDto> findStateByCode(String stateCode) {
        String sql = "SELECT id, stateCode, stateName, status FROM state_master WHERE stateCode = :code";
        List<StateMasterDto> rows = jdbc.query(sql, new MapSqlParameterSource("code", stateCode), this::mapState);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    public long insertState(String code, String name, String createdBy) {
        String sql = """
                INSERT INTO state_master (stateCode, stateName, status, createdBy)
                VALUES (:code, :name, 'ACTIVE', :createdBy)
                """;
        KeyHolder keys = new GeneratedKeyHolder();
        jdbc.update(sql, new MapSqlParameterSource()
                .addValue("code", code)
                .addValue("name", name)
                .addValue("createdBy", createdBy), keys);
        return Objects.requireNonNull(keys.getKey()).longValue();
    }

    public boolean stateCodeExists(String code) {
        String sql = "SELECT COUNT(*) FROM state_master WHERE stateCode = :code";
        Integer count = jdbc.queryForObject(sql, new MapSqlParameterSource("code", code), Integer.class);
        return count != null && count > 0;
    }

    // ── cities ────────────────────────────────────────────────────────────────

    public List<CityMasterDto> findCitiesByState(String stateCode, boolean activeOnly) {
        String sql = """
                SELECT id, cityCode, cityName, stateCode, status
                FROM city_master
                WHERE stateCode = :stateCode
                """ + (activeOnly ? " AND status = 'ACTIVE' " : "") + """
                ORDER BY cityName
                """;
        return jdbc.query(sql, new MapSqlParameterSource("stateCode", stateCode), this::mapCity);
    }

    public List<CityMasterDto> findAllCities(boolean activeOnly) {
        String sql = """
                SELECT id, cityCode, cityName, stateCode, status
                FROM city_master
                """ + (activeOnly ? " WHERE status = 'ACTIVE' " : "") + """
                ORDER BY stateCode, cityName
                """;
        return jdbc.query(sql, new MapSqlParameterSource(), this::mapCity);
    }

    public Optional<CityMasterDto> findCity(String stateCode, String cityCode) {
        String sql = """
                SELECT id, cityCode, cityName, stateCode, status
                FROM city_master
                WHERE stateCode = :stateCode AND cityCode = :cityCode
                """;
        List<CityMasterDto> rows = jdbc.query(sql, new MapSqlParameterSource()
                .addValue("stateCode", stateCode)
                .addValue("cityCode", cityCode), this::mapCity);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    public long insertCity(String code, String name, String stateCode, String createdBy) {
        String sql = """
                INSERT INTO city_master (cityCode, cityName, stateCode, status, createdBy)
                VALUES (:code, :name, :stateCode, 'ACTIVE', :createdBy)
                """;
        KeyHolder keys = new GeneratedKeyHolder();
        jdbc.update(sql, new MapSqlParameterSource()
                .addValue("code", code)
                .addValue("name", name)
                .addValue("stateCode", stateCode)
                .addValue("createdBy", createdBy), keys);
        return Objects.requireNonNull(keys.getKey()).longValue();
    }

    public boolean cityCodeExists(String stateCode, String cityCode) {
        String sql = "SELECT COUNT(*) FROM city_master WHERE stateCode = :stateCode AND cityCode = :cityCode";
        Integer count = jdbc.queryForObject(sql, new MapSqlParameterSource()
                .addValue("stateCode", stateCode)
                .addValue("cityCode", cityCode), Integer.class);
        return count != null && count > 0;
    }

    // ── locations ─────────────────────────────────────────────────────────────

    private static final String LOCATION_SELECT = """
            SELECT lm.locationId, lm.descriptiveName, lm.address,
                   lm.stateCode, sm.stateName,
                   lm.cityCode, cm.cityName,
                   lm.companyId, co.companyName,
                   lm.locationTypeId, lt.typeName AS locationTypeName,
                   lm.status
            FROM location_master lm
            JOIN company_master co ON co.id = lm.companyId
            JOIN location_type_master lt ON lt.id = lm.locationTypeId
            JOIN state_master sm ON sm.stateCode = lm.stateCode
            JOIN city_master cm ON cm.stateCode = lm.stateCode AND cm.cityCode = lm.cityCode
            """;

    public List<LocationMasterDto> findLocations(LocationListFilterDto filters, int offset, int limit) {
        String sql = LOCATION_SELECT + locationFilterClause() + """
                ORDER BY lm.locationId
                LIMIT :limit OFFSET :offset
                """;
        MapSqlParameterSource params = locationFilterParams(filters)
                .addValue("limit", limit)
                .addValue("offset", offset);
        return jdbc.query(sql, params, this::mapLocation);
    }

    public long countLocations(LocationListFilterDto filters) {
        String sql = """
                SELECT COUNT(*)
                FROM location_master lm
                JOIN company_master co ON co.id = lm.companyId
                JOIN location_type_master lt ON lt.id = lm.locationTypeId
                JOIN state_master sm ON sm.stateCode = lm.stateCode
                JOIN city_master cm ON cm.stateCode = lm.stateCode AND cm.cityCode = lm.cityCode
                """ + locationFilterClause();
        Long count = jdbc.queryForObject(sql, locationFilterParams(filters), Long.class);
        return count != null ? count : 0L;
    }

    private static String locationFilterClause() {
        return """
                WHERE (:locationId = '' OR LOWER(lm.locationId) LIKE :locationIdLike)
                  AND (:locationName = '' OR LOWER(lm.descriptiveName) LIKE :locationNameLike)
                  AND (:status = '' OR lm.status = :status)
                """;
    }

    private static MapSqlParameterSource locationFilterParams(LocationListFilterDto filters) {
        String locationId = filters == null || filters.getLocationId() == null ? "" : filters.getLocationId().trim();
        String locationName = filters == null || filters.getLocationName() == null ? "" : filters.getLocationName().trim();
        String status = filters == null || filters.getStatus() == null ? "" : filters.getStatus().trim().toUpperCase();
        if (!status.isEmpty() && !status.equals("ACTIVE") && !status.equals("INACTIVE")) {
            status = "";
        }
        return new MapSqlParameterSource()
                .addValue("locationId", locationId)
                .addValue("locationIdLike", "%" + locationId.toLowerCase() + "%")
                .addValue("locationName", locationName)
                .addValue("locationNameLike", "%" + locationName.toLowerCase() + "%")
                .addValue("status", status);
    }

    public Optional<LocationMasterDto> findLocationById(String locationId) {
        String sql = LOCATION_SELECT + " WHERE lm.locationId = :id";
        List<LocationMasterDto> rows = jdbc.query(sql, new MapSqlParameterSource("id", locationId), this::mapLocation);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    /** @param idPrefix e.g. {@code MED-HO-} */
    public int nextSequenceForIdPrefix(String idPrefix) {
        String sql = """
                SELECT COALESCE(MAX(sequenceNum), 0) + 1
                FROM location_master
                WHERE locationId LIKE :prefix
                """;
        Integer next = jdbc.queryForObject(sql, new MapSqlParameterSource("prefix", idPrefix + "%"), Integer.class);
        return next != null ? next : 1;
    }

    public void insertLocation(String locationId, long companyId, long locationTypeId,
                               String stateCode, String cityCode, String address,
                               String descriptiveName, int sequenceNum, String createdBy) {
        String sql = """
                INSERT INTO location_master
                    (locationId, companyId, locationTypeId, stateCode, cityCode,
                     address, descriptiveName, sequenceNum, status, createdBy)
                VALUES
                    (:locationId, :companyId, :locationTypeId, :stateCode, :cityCode,
                     :address, :descriptiveName, :sequenceNum, 'ACTIVE', :createdBy)
                """;
        jdbc.update(sql, new MapSqlParameterSource()
                .addValue("locationId", locationId)
                .addValue("companyId", companyId)
                .addValue("locationTypeId", locationTypeId)
                .addValue("stateCode", stateCode)
                .addValue("cityCode", cityCode)
                .addValue("address", address)
                .addValue("descriptiveName", descriptiveName)
                .addValue("sequenceNum", sequenceNum)
                .addValue("createdBy", createdBy));
    }

    public void updateLocationStatus(String locationId, boolean active, String modifiedBy) {
        String sql = """
                UPDATE location_master
                SET status = :status, modifiedBy = :modifiedBy
                WHERE locationId = :id
                """;
        jdbc.update(sql, new MapSqlParameterSource()
                .addValue("id", locationId)
                .addValue("status", active ? "ACTIVE" : "INACTIVE")
                .addValue("modifiedBy", modifiedBy));
    }

    public Optional<String> findLocationNameByCode(String locationId) {
        String sql = "SELECT descriptiveName FROM location_master WHERE locationId = :id";
        List<String> rows = jdbc.query(sql, new MapSqlParameterSource("id", locationId),
                (rs, rowNum) -> rs.getString("descriptiveName"));
        return rows.isEmpty() ? Optional.empty() : Optional.ofNullable(rows.get(0));
    }

    public List<LocationMasterDto> findActiveLocationsForDropdown() {
        String sql = LOCATION_SELECT + " WHERE lm.status = 'ACTIVE' ORDER BY lm.descriptiveName";
        return jdbc.query(sql, new MapSqlParameterSource(), this::mapLocation);
    }

    public List<LocationMasterDto> searchActiveLocations(String query) {
        String like = "%" + query.trim().toLowerCase() + "%";
        String sql = LOCATION_SELECT + """
                WHERE lm.status = 'ACTIVE'
                  AND (LOWER(lm.locationId) LIKE :like OR LOWER(lm.descriptiveName) LIKE :like)
                ORDER BY lm.descriptiveName
                LIMIT 20
                """;
        return jdbc.query(sql, new MapSqlParameterSource("like", like), this::mapLocation);
    }

    // ── row mappers ───────────────────────────────────────────────────────────

    private CompanyMasterDto mapCompany(ResultSet rs, int rowNum) throws SQLException {
        return CompanyMasterDto.builder()
                .id(rs.getLong("id"))
                .companyCode(rs.getString("companyCode"))
                .companyName(rs.getString("companyName"))
                .active("ACTIVE".equals(rs.getString("status")))
                .build();
    }

    private LocationTypeMasterDto mapLocationType(ResultSet rs, int rowNum) throws SQLException {
        return LocationTypeMasterDto.builder()
                .id(rs.getLong("id"))
                .typeCode(rs.getString("typeCode"))
                .typeName(rs.getString("typeName"))
                .active("ACTIVE".equals(rs.getString("status")))
                .build();
    }

    private StateMasterDto mapState(ResultSet rs, int rowNum) throws SQLException {
        return StateMasterDto.builder()
                .id(rs.getLong("id"))
                .stateCode(rs.getString("stateCode"))
                .stateName(rs.getString("stateName"))
                .active("ACTIVE".equals(rs.getString("status")))
                .build();
    }

    private CityMasterDto mapCity(ResultSet rs, int rowNum) throws SQLException {
        return CityMasterDto.builder()
                .id(rs.getLong("id"))
                .cityCode(rs.getString("cityCode"))
                .cityName(rs.getString("cityName"))
                .stateCode(rs.getString("stateCode"))
                .active("ACTIVE".equals(rs.getString("status")))
                .build();
    }

    private LocationMasterDto mapLocation(ResultSet rs, int rowNum) throws SQLException {
        return LocationMasterDto.builder()
                .locationId(rs.getString("locationId"))
                .descriptiveName(rs.getString("descriptiveName"))
                .address(rs.getString("address"))
                .stateCode(rs.getString("stateCode"))
                .stateName(rs.getString("stateName"))
                .cityCode(rs.getString("cityCode"))
                .cityName(rs.getString("cityName"))
                .companyId(rs.getLong("companyId"))
                .companyName(rs.getString("companyName"))
                .locationTypeId(rs.getLong("locationTypeId"))
                .locationTypeName(rs.getString("locationTypeName"))
                .active("ACTIVE".equals(rs.getString("status")))
                .build();
    }
}
