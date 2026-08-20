package com.medplus.frontdesk_backend.repository;

import com.medplus.frontdesk_backend.dto.DashboardStatsDto;
import com.medplus.frontdesk_backend.dto.PersonToMeetDto;
import com.medplus.frontdesk_backend.dto.StatusCountsDto;
import com.medplus.frontdesk_backend.dto.VisitorFlowPointDto;
import com.medplus.frontdesk_backend.model.EntryType;
import com.medplus.frontdesk_backend.model.GovtIdType;
import com.medplus.frontdesk_backend.model.VisitStatus;
import com.medplus.frontdesk_backend.model.VisitType;
import com.medplus.frontdesk_backend.model.Visitor;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class VisitorRepository {

    private static final String VISITOR_LOG_SELECT =
            "visitorId, visitType, groupId, entryType, name, mobile, empId, "
            + "status, personToMeet, personName, personToMeetPhone, department, "
            + "locationId, cardNumber, govtIdType, govtIdNumber, "
            + "checkInTime, checkOutTime, approvedAt, rejectedAt, rejectionRemarks, "
            + "reasonForVisit, companyName, createdBy, workstationMac, "
            + "checkInDeviceId, lastScanDeviceId, lastScanAt";

    /** Safe SELECT — never use text-block concat after {@link #VISITOR_LOG_SELECT} (drops space before FROM). */
    private static String selectVisitorLog(String whereAndRest) {
        return "SELECT " + VISITOR_LOG_SELECT + " FROM visitorlog " + whereAndRest;
    }

    private final NamedParameterJdbcTemplate jdbc;

    public int nextGroupSequence() {
        String sql = """
                SELECT COALESCE(
                    MAX(CAST(SUBSTRING_INDEX(groupId, '-', -1) AS UNSIGNED)), 0
                ) + 1
                FROM visitorlog
                WHERE groupId IS NOT NULL
                  AND groupId LIKE 'MED-GROUP-%'
                """;
        Integer next = jdbc.queryForObject(sql, new MapSqlParameterSource(), Integer.class);
        return next == null ? 1 : next;
    }

    // ── Visitor CRUD ──────────────────────────────────────────────────────────

    public void insertVisitor(Visitor v) {
        String tempId = "TEMP-" + java.util.UUID.randomUUID().toString().replace("-", "");
        if (tempId.length() > 32) {
            tempId = tempId.substring(0, 32);
        }
        v.setVisitorId(tempId);

        String sql = """
                INSERT INTO visitorlog
                     (visitorId, visitType, groupId, entryType, name, mobile, empId,
                     status, personToMeet, personName, personToMeetPhone, department,
                     locationId, cardNumber, govtIdType, govtIdNumber,
                     checkInTime, reasonForVisit, companyName, createdBy, workstationMac,
                     checkInDeviceId, lastScanDeviceId, lastScanAt)
                VALUES
                    (:visitorId, :visitType, :groupId, :entryType, :name, :mobile, :empId,
                     :status, :personToMeet, :personName, :personToMeetPhone, :department,
                     :locationId, :cardNumber, :govtIdType, :govtIdNumber,
                     :checkInTime, :reasonForVisit, :companyName, :createdBy, :workstationMac,
                     :checkInDeviceId, :lastScanDeviceId, :lastScanAt)
                """;
        jdbc.update(sql, new MapSqlParameterSource()
                .addValue("visitorId",      v.getVisitorId())
                .addValue("visitType",      v.getVisitType().name())
                .addValue("groupId",        v.getGroupId())
                .addValue("entryType",      v.getEntryType().name())
                .addValue("name",           v.getName())
                .addValue("mobile",         v.getMobile())
                .addValue("empId",          v.getEmpId())
                .addValue("status",         v.getStatus().name())
                .addValue("personToMeet",   v.getPersonToMeet())
                .addValue("personName",     v.getPersonName())
                .addValue("personToMeetPhone", v.getPersonToMeetPhone())
                .addValue("department",     v.getDepartment())
                .addValue("locationId",     v.getLocationId())
                .addValue("cardNumber",     v.getCardNumber())
                .addValue("govtIdType",     v.getGovtIdType() != null ? v.getGovtIdType().name() : null)
                .addValue("govtIdNumber",   v.getGovtIdNumber())
                .addValue("checkInTime",    v.getCheckInTime())
                .addValue("reasonForVisit", v.getReasonForVisit())
                .addValue("companyName",    v.getCompanyName())
                .addValue("createdBy",      v.getCreatedBy())
                .addValue("workstationMac", v.getWorkstationMac())
                .addValue("checkInDeviceId", v.getCheckInDeviceId())
                .addValue("lastScanDeviceId", v.getLastScanDeviceId())
                .addValue("lastScanAt",     v.getLastScanAt())
        );

        Long seqId = jdbc.queryForObject(
                "SELECT seq_id FROM visitorlog WHERE visitorId = :visitorId",
                new MapSqlParameterSource("visitorId", tempId),
                Long.class
        );
        if (seqId == null || seqId == 0L) {
            throw new IllegalStateException("Failed to retrieve generated seq_id during visitor insertion.");
        }

        String displayId;
        if (v.getVisitType() == VisitType.GROUP) {
            displayId = String.format("MED-GV-%04d", seqId);
        } else {
            displayId = String.format("MED-V-%04d", seqId);
        }

        jdbc.update("UPDATE visitorlog SET visitorId = :displayId WHERE visitorId = :tempId",
                new MapSqlParameterSource()
                        .addValue("displayId", displayId)
                        .addValue("tempId", tempId));
        v.setVisitorId(displayId);
    }

    public void updateLastScan(String visitorId, String deviceId, LocalDateTime scannedAt) {
        jdbc.update("""
                UPDATE visitorlog
                SET lastScanDeviceId = :deviceId, lastScanAt = :scannedAt
                WHERE visitorId = :visitorId
                """, new MapSqlParameterSource()
                .addValue("visitorId", visitorId)
                .addValue("deviceId", deviceId)
                .addValue("scannedAt", scannedAt));
    }

    public Optional<String> findVisitorIdByPreregToken(String token) {
        String sql = """
                SELECT visitorId FROM preregistrations
                WHERE token = :token AND visitorId IS NOT NULL
                LIMIT 1
                """;
        List<String> rows = jdbc.query(sql, new MapSqlParameterSource("token", token),
                (rs, rowNum) -> rs.getString("visitorId"));
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    /**
     * Today's pending / approved visits for a host mobile — Key Management portal.
     * Rejected visits are omitted (desk app retains the rejection record).
     */
    public List<Visitor> findTodayByPersonToMeetPhone(String phone, LocalDateTime since, int limit) {
        String digits = phone != null ? phone.replaceAll("\\D", "") : "";
        if (digits.isBlank()) {
            return List.of();
        }
        int safeLimit = Math.max(1, Math.min(limit, 100));
        String sql = selectVisitorLog("""
                WHERE personToMeetPhone = :phone
                  AND status IN ('PENDING_APPROVAL','APPROVED')
                  AND checkInTime >= :since
                ORDER BY
                  CASE status
                    WHEN 'PENDING_APPROVAL' THEN 0
                    ELSE 1
                  END,
                  checkInTime DESC
                LIMIT :limit
                """);
        return jdbc.query(sql, new MapSqlParameterSource()
                        .addValue("phone", digits)
                        .addValue("since", since)
                        .addValue("limit", safeLimit),
                this::mapVisitorRow);
    }

    public int approvePendingVisit(String visitorId, String hostMobile) {
        return jdbc.update("""
                UPDATE visitorlog
                SET status = 'APPROVED',
                    approvedAt = CURRENT_TIMESTAMP,
                    rejectedAt = NULL,
                    rejectionRemarks = NULL
                WHERE visitorId = :visitorId
                  AND personToMeetPhone = :phone
                  AND status = 'PENDING_APPROVAL'
                """, new MapSqlParameterSource()
                .addValue("visitorId", visitorId)
                .addValue("phone", hostMobile));
    }

    public int rejectPendingVisit(String visitorId, String hostMobile, String remarks) {
        return jdbc.update("""
                UPDATE visitorlog
                SET status = 'REJECTED',
                    rejectedAt = CURRENT_TIMESTAMP,
                    rejectionRemarks = :remarks,
                    approvedAt = NULL
                WHERE visitorId = :visitorId
                  AND personToMeetPhone = :phone
                  AND status = 'PENDING_APPROVAL'
                """, new MapSqlParameterSource()
                .addValue("visitorId", visitorId)
                .addValue("phone", hostMobile)
                .addValue("remarks", remarks));
    }

    public int approvePendingVisitsByGroupId(String groupId, String hostMobile) {
        return jdbc.update("""
                UPDATE visitorlog
                SET status = 'APPROVED',
                    approvedAt = CURRENT_TIMESTAMP,
                    rejectedAt = NULL,
                    rejectionRemarks = NULL
                WHERE groupId = :groupId
                  AND personToMeetPhone = :phone
                  AND status = 'PENDING_APPROVAL'
                """, new MapSqlParameterSource()
                .addValue("groupId", groupId)
                .addValue("phone", hostMobile));
    }

    public int rejectPendingVisitsByGroupId(String groupId, String hostMobile, String remarks) {
        return jdbc.update("""
                UPDATE visitorlog
                SET status = 'REJECTED',
                    rejectedAt = CURRENT_TIMESTAMP,
                    rejectionRemarks = :remarks,
                    approvedAt = NULL
                WHERE groupId = :groupId
                  AND personToMeetPhone = :phone
                  AND status = 'PENDING_APPROVAL'
                """, new MapSqlParameterSource()
                .addValue("groupId", groupId)
                .addValue("phone", hostMobile)
                .addValue("remarks", remarks));
    }

    /**
     * Approves specific pending members in a group. Skips non-pending rows.
     * @return number of rows updated
     */
    public int approvePendingMembersByIds(String groupId, String hostMobile, java.util.Collection<String> visitorIds) {
        if (visitorIds == null || visitorIds.isEmpty()) {
            return 0;
        }
        return jdbc.update("""
                UPDATE visitorlog
                SET status = 'APPROVED',
                    approvedAt = CURRENT_TIMESTAMP,
                    rejectedAt = NULL,
                    rejectionRemarks = NULL
                WHERE groupId = :groupId
                  AND personToMeetPhone = :phone
                  AND status = 'PENDING_APPROVAL'
                  AND visitorId IN (:visitorIds)
                """, new MapSqlParameterSource()
                .addValue("groupId", groupId)
                .addValue("phone", hostMobile)
                .addValue("visitorIds", visitorIds));
    }

    /**
     * Rejects specific pending members in a group. Skips non-pending rows.
     * @return number of rows updated
     */
    public int rejectPendingMembersByIds(String groupId, String hostMobile,
                                         java.util.Collection<String> visitorIds, String remarks) {
        if (visitorIds == null || visitorIds.isEmpty()) {
            return 0;
        }
        return jdbc.update("""
                UPDATE visitorlog
                SET status = 'REJECTED',
                    rejectedAt = CURRENT_TIMESTAMP,
                    rejectionRemarks = :remarks,
                    approvedAt = NULL
                WHERE groupId = :groupId
                  AND personToMeetPhone = :phone
                  AND status = 'PENDING_APPROVAL'
                  AND visitorId IN (:visitorIds)
                """, new MapSqlParameterSource()
                .addValue("groupId", groupId)
                .addValue("phone", hostMobile)
                .addValue("visitorIds", visitorIds)
                .addValue("remarks", remarks));
    }

    public List<Visitor> findByGroupId(String groupId) {
        String sql = selectVisitorLog("""
                WHERE groupId = :groupId
                ORDER BY checkInTime ASC, visitorId ASC
                """);
        return jdbc.query(sql, new MapSqlParameterSource("groupId", groupId), this::mapVisitorRow);
    }

    public void updateVisitor(Visitor v) {
        String sql = """
                UPDATE visitorlog
                SET name           = :name,
                    mobile         = :mobile,
                    empId          = :empId,
                    personToMeet   = :personToMeet,
                    personName     = :personName,
                    personToMeetPhone = :personToMeetPhone,
                    department     = :department,
                    cardNumber     = :cardNumber,
                    govtIdType     = :govtIdType,
                    govtIdNumber   = :govtIdNumber,
                    reasonForVisit = :reasonForVisit,
                    companyName    = :companyName,
                    modifiedBy     = :modifiedBy
                WHERE visitorId = :visitorId
                """;
        jdbc.update(sql, new MapSqlParameterSource()
                .addValue("visitorId",      v.getVisitorId())
                .addValue("name",           v.getName())
                .addValue("mobile",         v.getMobile())
                .addValue("empId",          v.getEmpId())
                .addValue("personToMeet",   v.getPersonToMeet())
                .addValue("personName",     v.getPersonName())
                .addValue("personToMeetPhone", v.getPersonToMeetPhone())
                .addValue("department",     v.getDepartment())
                .addValue("cardNumber",     v.getCardNumber())
                .addValue("govtIdType",     v.getGovtIdType() != null ? v.getGovtIdType().name() : null)
                .addValue("govtIdNumber",   v.getGovtIdNumber())
                .addValue("reasonForVisit", v.getReasonForVisit())
                .addValue("companyName",    v.getCompanyName())
                .addValue("modifiedBy",     v.getModifiedBy())
        );
    }

    public void checkOutVisitor(String visitorId, LocalDateTime checkOutTime, String modifiedBy) {
        String sql = """
                UPDATE visitorlog
                SET status = 'CHECKED_OUT', checkOutTime = :checkOutTime, modifiedBy = :modifiedBy
                WHERE visitorId = :visitorId
                """;
        jdbc.update(sql, new MapSqlParameterSource()
                .addValue("visitorId",    visitorId)
                .addValue("checkOutTime", checkOutTime)
                .addValue("modifiedBy",   modifiedBy)
        );
    }

    public Optional<Visitor> findById(String visitorId) {
        String sql = selectVisitorLog("WHERE visitorId = :visitorId");
        List<Visitor> rows = jdbc.query(sql,
                new MapSqlParameterSource("visitorId", visitorId), this::mapVisitorRow);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    /**
     * Returns entries for a specific location on a given date.
     * Optional department filter: pass null to skip.
     */
    public List<Visitor> findByLocationAndDate(String locationId, java.time.LocalDate date, String department) {
        LocalDateTime start = date.atStartOfDay();
        LocalDateTime end   = date.plusDays(1).atStartOfDay();
        String sql = selectVisitorLog(
                "WHERE locationId = :locationId "
                + "AND checkInTime >= :start AND checkInTime < :end "
                + (department != null ? "AND department = :department " : "")
                + "ORDER BY checkInTime DESC");
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("locationId", locationId)
                .addValue("start",      start)
                .addValue("end",        end);
        if (department != null) params.addValue("department", department);
        return jdbc.query(sql, params, this::mapVisitorRow);
    }

    /**
     * Returns all entries across ALL locations on a given date.
     * Used by PRIMARY_ADMIN / REGIONAL_ADMIN when no specific location is selected.
     * Optional department filter: pass null to skip.
     */
    public List<Visitor> findAllByDate(java.time.LocalDate date, String department) {
        LocalDateTime start = date.atStartOfDay();
        LocalDateTime end   = date.plusDays(1).atStartOfDay();
        String sql = selectVisitorLog(
                "WHERE checkInTime >= :start AND checkInTime < :end "
                + (department != null ? "AND department = :department " : "")
                + "ORDER BY locationId, checkInTime DESC");
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("start", start)
                .addValue("end",   end);
        if (department != null) params.addValue("department", department);
        return jdbc.query(sql, params, this::mapVisitorRow);
    }

    /**
     * Full-text search within a specific location + date.
     * Searches: name, mobile, empId, personName.
     * Optional department filter: pass null to skip.
     */
    public List<Visitor> searchByLocationAndDate(String locationId, java.time.LocalDate date, String query, String department) {
        LocalDateTime start = date.atStartOfDay();
        LocalDateTime end   = date.plusDays(1).atStartOfDay();
        String like = "%" + query.trim().toLowerCase() + "%";
        String sql = selectVisitorLog(
                "WHERE locationId = :locationId "
                + "AND checkInTime >= :start AND checkInTime < :end "
                + "AND (LOWER(name) LIKE :q OR LOWER(mobile) LIKE :q OR LOWER(empId) LIKE :q OR LOWER(personName) LIKE :q) "
                + (department != null ? "AND department = :department " : "")
                + "ORDER BY checkInTime DESC");
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("locationId", locationId)
                .addValue("start",      start)
                .addValue("end",        end)
                .addValue("q",          like);
        if (department != null) params.addValue("department", department);
        return jdbc.query(sql, params, this::mapVisitorRow);
    }

    /**
     * Full-text search across ALL locations on a given date.
     * Used by admins who have not filtered to a specific location.
     */
    public List<Visitor> searchAllByDate(java.time.LocalDate date, String query, String department) {
        LocalDateTime start = date.atStartOfDay();
        LocalDateTime end   = date.plusDays(1).atStartOfDay();
        String like = "%" + query.trim().toLowerCase() + "%";
        String sql = selectVisitorLog(
                "WHERE checkInTime >= :start AND checkInTime < :end "
                + "AND (LOWER(name) LIKE :q OR LOWER(mobile) LIKE :q OR LOWER(empId) LIKE :q OR LOWER(personName) LIKE :q) "
                + (department != null ? "AND department = :department " : "")
                + "ORDER BY locationId, checkInTime DESC");
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("start", start)
                .addValue("end",   end)
                .addValue("q",     like);
        if (department != null) params.addValue("department", department);
        return jdbc.query(sql, params, this::mapVisitorRow);
    }

    /**
     * Returns distinct, non-null department names present in visitorlog.
     *
     * @param locationId restrict to a specific location; null = all locations
     * @param date       restrict to a single calendar day; null = all dates
     */
    public List<String> findDistinctDepartmentsInLog(String locationId, java.time.LocalDate date) {
        StringBuilder sql = new StringBuilder(
                "SELECT DISTINCT department FROM visitorlog WHERE department IS NOT NULL\n");
        MapSqlParameterSource params = new MapSqlParameterSource();

        if (locationId != null) {
            sql.append("  AND locationId = :locationId\n");
            params.addValue("locationId", locationId);
        }
        if (date != null) {
            sql.append("  AND checkInTime >= :start AND checkInTime < :end\n");
            params.addValue("start", date.atStartOfDay());
            params.addValue("end",   date.plusDays(1).atStartOfDay());
        }
        sql.append("ORDER BY department");
        return jdbc.queryForList(sql.toString(), params, String.class);
    }

    /**
     * Looks up the human-readable name of a location by its ID.
     */
    public Optional<String> findLocationName(String locationId) {
        String sql = """
                SELECT name FROM (
                    SELECT descriptiveName AS name, 1 AS prio
                    FROM location_master WHERE locationId = :locationId
                    UNION ALL
                    SELECT COALESCE(NULLIF(locationName, ''), location) AS name, 2 AS prio
                    FROM usermanagement WHERE location = :locationId
                ) AS sources
                ORDER BY prio
                LIMIT 1
                """;
        List<String> rows = jdbc.queryForList(sql,
                new MapSqlParameterSource("locationId", locationId), String.class);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    // ── Paginated queries (all-dates or date-scoped) ──────────────────────────

    /**
     * Date filter for list/search:
     * <ul>
     *   <li>{@code null} (All tab) — check-in within range OR still checked in</li>
     *   <li>{@code CHECKED_IN} / {@code CHECKED_OUT} — check-in within range (same date bounds)</li>
     * </ul>
     */
    private void appendListDateFilter(StringBuilder sql,
                                      MapSqlParameterSource params,
                                      java.time.LocalDate from,
                                      java.time.LocalDate to,
                                      String status) {
        if (from == null && to == null) {
            return;
        }
        if (status == null) {
            sql.append("  AND (");
            if (from != null && to != null) {
                sql.append("checkInTime >= :from AND checkInTime < :toEnd");
                params.addValue("from", from.atStartOfDay());
                params.addValue("toEnd", to.plusDays(1).atStartOfDay());
            } else if (from != null) {
                sql.append("checkInTime >= :from");
                params.addValue("from", from.atStartOfDay());
            } else {
                sql.append("checkInTime < :toEnd");
                params.addValue("toEnd", to.plusDays(1).atStartOfDay());
            }
            sql.append(" OR status IN ('CHECKED_IN','APPROVED','PENDING_APPROVAL'))\n");
            return;
        }
        // CHECKED_IN and CHECKED_OUT: honour the same date range as the UI filter.
        if (from != null) {
            sql.append("  AND checkInTime >= :from\n");
            params.addValue("from", from.atStartOfDay());
        }
        if (to != null) {
            sql.append("  AND checkInTime < :toEnd\n");
            params.addValue("toEnd", to.plusDays(1).atStartOfDay());
        }
    }

    /** Appends status predicate; CHECKED_IN tab also includes PENDING_APPROVAL. */
    private void appendStatusFilter(StringBuilder sql, MapSqlParameterSource params, String status) {
        if (status == null || status.isBlank()) {
            return;
        }
        if ("CHECKED_IN".equalsIgnoreCase(status)) {
            sql.append("  AND status IN ('CHECKED_IN','APPROVED','PENDING_APPROVAL')\n");
            return;
        }
        sql.append("  AND status = :status\n");
        params.addValue("status", status);
    }

    private void appendColumnFilters(StringBuilder sql, MapSqlParameterSource params,
                                     com.medplus.frontdesk_backend.dto.VisitorListFilterDto filters) {
        if (filters == null) return;
        if (filters.getEntryType() != null) {
            sql.append("  AND entryType = :entryType\n");
            params.addValue("entryType", filters.getEntryType().trim().toUpperCase());
        }
        if (filters.getName() != null) {
            sql.append("  AND LOWER(name) LIKE :visitorName\n");
            params.addValue("visitorName", "%" + filters.getName().trim().toLowerCase() + "%");
        }
        if (filters.getContactQuery() != null) {
            sql.append("  AND (LOWER(IFNULL(mobile, '')) LIKE :contactQuery")
                    .append(" OR LOWER(IFNULL(empId, '')) LIKE :contactQuery)\n");
            params.addValue("contactQuery", "%" + filters.getContactQuery().trim().toLowerCase() + "%");
        }
        if (filters.getPersonToMeet() != null) {
            sql.append("  AND LOWER(IFNULL(personName, '')) LIKE :personToMeet\n");
            params.addValue("personToMeet", "%" + filters.getPersonToMeet().trim().toLowerCase() + "%");
        }
        if (filters.getCardNumber() != null) {
            sql.append("  AND CAST(IFNULL(cardNumber, '') AS CHAR) LIKE :cardNumber\n");
            params.addValue("cardNumber", "%" + filters.getCardNumber().trim() + "%");
        }
    }

    /**
     * Returns a single page of visitor entries.
     * All filter parameters are optional (null = no filter for that dimension).
     *
     * @param locationId restrict to a single location; null = all locations
     * @param date       restrict to a single calendar day; null = all dates
     * @param department restrict to a department name; null = all departments
     * @param status     restrict by visit status ("CHECKED_IN" / "CHECKED_OUT"); null = all
     * @param offset     OFFSET for SQL (page * size)
     * @param limit      LIMIT for SQL (page size)
     */
    public List<Visitor> findPaged(String locationId,
                                   java.time.LocalDate from, java.time.LocalDate to,
                                   String department, String status, String createdBy,
                                   com.medplus.frontdesk_backend.dto.VisitorListFilterDto columnFilters,
                                   int offset, int limit) {
        StringBuilder sql = new StringBuilder(selectVisitorLog("WHERE 1=1 "));
        MapSqlParameterSource params = new MapSqlParameterSource();
        if (locationId != null) {
            sql.append("  AND locationId = :locationId\n");
            params.addValue("locationId", locationId);
        }
        appendListDateFilter(sql, params, from, to, status);
        if (department != null) {
            sql.append("  AND department = :department\n");
            params.addValue("department", department);
        }
        appendStatusFilter(sql, params, status);
        if (createdBy != null && !createdBy.isBlank()) {
            sql.append("  AND LOWER(createdBy) = LOWER(:createdBy)\n");
            params.addValue("createdBy", createdBy.trim());
        }
        appendColumnFilters(sql, params, columnFilters);
        sql.append("ORDER BY checkInTime DESC\nLIMIT :limit OFFSET :offset");
        params.addValue("limit", limit).addValue("offset", offset);
        return jdbc.query(sql.toString(), params, this::mapVisitorRow);
    }

    /**
     * Returns the total count of records matching the same optional filters used by
     * {@link #findPaged}. Used to calculate total pages.
     */
    public long countFiltered(String locationId,
                              java.time.LocalDate from, java.time.LocalDate to,
                              String department, String status, String createdBy,
                              com.medplus.frontdesk_backend.dto.VisitorListFilterDto columnFilters) {
        StringBuilder sql = new StringBuilder("SELECT COUNT(*) FROM visitorlog WHERE 1=1\n");
        MapSqlParameterSource params = new MapSqlParameterSource();
        if (locationId != null) {
            sql.append("  AND locationId = :locationId\n");
            params.addValue("locationId", locationId);
        }
        appendListDateFilter(sql, params, from, to, status);
        if (department != null) {
            sql.append("  AND department = :department\n");
            params.addValue("department", department);
        }
        appendStatusFilter(sql, params, status);
        if (createdBy != null && !createdBy.isBlank()) {
            sql.append("  AND LOWER(createdBy) = LOWER(:createdBy)\n");
            params.addValue("createdBy", createdBy.trim());
        }
        appendColumnFilters(sql, params, columnFilters);
        Long count = jdbc.queryForObject(sql.toString(), params, Long.class);
        return count == null ? 0L : count;
    }

    /**
     * Full-text search within a paginated result set.
     * Searches name, mobile, empId, and personName.
     * All filter parameters are optional (null = no filter).
     */
    public List<Visitor> searchPaged(String locationId,
                                     java.time.LocalDate from, java.time.LocalDate to,
                                     String query, String department, String status,
                                     String createdBy,
                                     com.medplus.frontdesk_backend.dto.VisitorListFilterDto columnFilters,
                                     int offset, int limit) {
        String like = "%" + query.trim().toLowerCase() + "%";
        StringBuilder sql = new StringBuilder(selectVisitorLog(
                "WHERE (LOWER(name) LIKE :q OR LOWER(mobile) LIKE :q OR LOWER(empId) LIKE :q OR LOWER(personName) LIKE :q) "));
        MapSqlParameterSource params = new MapSqlParameterSource("q", like);
        if (locationId != null) {
            sql.append("  AND locationId = :locationId\n");
            params.addValue("locationId", locationId);
        }
        appendListDateFilter(sql, params, from, to, status);
        if (department != null) {
            sql.append("  AND department = :department\n");
            params.addValue("department", department);
        }
        appendStatusFilter(sql, params, status);
        if (createdBy != null && !createdBy.isBlank()) {
            sql.append("  AND LOWER(createdBy) = LOWER(:createdBy)\n");
            params.addValue("createdBy", createdBy.trim());
        }
        appendColumnFilters(sql, params, columnFilters);
        sql.append("ORDER BY checkInTime DESC\nLIMIT :limit OFFSET :offset");
        params.addValue("limit", limit).addValue("offset", offset);
        return jdbc.query(sql.toString(), params, this::mapVisitorRow);
    }

    /**
     * Count of search matches — mirrors the filters in {@link #searchPaged}.
     */
    public long countSearch(String locationId,
                            java.time.LocalDate from, java.time.LocalDate to,
                            String query, String department, String status,
                            String createdBy,
                            com.medplus.frontdesk_backend.dto.VisitorListFilterDto columnFilters) {
        String like = "%" + query.trim().toLowerCase() + "%";
        StringBuilder sql = new StringBuilder("""
                SELECT COUNT(*) FROM visitorlog
                WHERE (
                    LOWER(name)       LIKE :q
                 OR LOWER(mobile)     LIKE :q
                 OR LOWER(empId)      LIKE :q
                 OR LOWER(personName) LIKE :q
                )
                """);
        MapSqlParameterSource params = new MapSqlParameterSource("q", like);
        if (locationId != null) {
            sql.append("  AND locationId = :locationId\n");
            params.addValue("locationId", locationId);
        }
        appendListDateFilter(sql, params, from, to, status);
        if (department != null) {
            sql.append("  AND department = :department\n");
            params.addValue("department", department);
        }
        appendStatusFilter(sql, params, status);
        if (createdBy != null && !createdBy.isBlank()) {
            sql.append("  AND LOWER(createdBy) = LOWER(:createdBy)\n");
            params.addValue("createdBy", createdBy.trim());
        }
        appendColumnFilters(sql, params, columnFilters);
        Long count = jdbc.queryForObject(sql.toString(), params, Long.class);
        return count == null ? 0L : count;
    }

    /**
     * Returns per-status counts for the Check-In/Check-Out tab badges.
     * Scoped to the given location (pass null for all-locations admin view).
     */
    public StatusCountsDto findStatusCounts(String locationId) {
        StringBuilder sql = new StringBuilder("""
                SELECT
                    COUNT(*)                                                      AS total,
                    SUM(CASE WHEN status IN ('CHECKED_IN','APPROVED','PENDING_APPROVAL') THEN 1 ELSE 0 END) AS checkedIn,
                    SUM(CASE WHEN status = 'CHECKED_OUT' THEN 1 ELSE 0 END)      AS checkedOut,
                    SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END)         AS rejected
                FROM visitorlog
                WHERE 1=1
                """);
        MapSqlParameterSource params = new MapSqlParameterSource();
        if (locationId != null) {
            sql.append("  AND locationId = :locationId\n");
            params.addValue("locationId", locationId);
        }
        return jdbc.queryForObject(sql.toString(), params, (rs, rowNum) ->
                StatusCountsDto.builder()
                        .total(rs.getLong("total"))
                        .checkedIn(rs.getLong("checkedIn"))
                        .checkedOut(rs.getLong("checkedOut"))
                        .rejected(rs.getLong("rejected"))
                        .build()
        );
    }

    /**
     * Returns the most recent {@code limit} entries at a specific location.
     * Used by the dashboard "Recent Visitors" widget.
     */
    public List<Visitor> findRecent(String locationId, int limit) {
        String sql = selectVisitorLog(
                "WHERE locationId = :locationId ORDER BY checkInTime DESC LIMIT :limit");
        return jdbc.query(sql, new MapSqlParameterSource()
                .addValue("locationId", locationId)
                .addValue("limit",      limit), this::mapVisitorRow);
    }

    /**
     * Returns the most recent {@code limit} entries across all locations.
     * Used by admins' dashboard "Recent Visitors" widget.
     */
    public List<Visitor> findRecentAll(int limit) {
        String sql = selectVisitorLog("ORDER BY checkInTime DESC LIMIT :limit");
        return jdbc.query(sql, new MapSqlParameterSource("limit", limit), this::mapVisitorRow);
    }

    /**
     * Recent entries filtered by department only (any location).
     * Used by DEPT_HEAD's dashboard "Recent Visitors" widget.
     */
    public List<Visitor> findRecentByDepartment(String department, int limit) {
        String sql = selectVisitorLog(
                "WHERE department = :department ORDER BY checkInTime DESC LIMIT :limit");
        return jdbc.query(sql, new MapSqlParameterSource()
                .addValue("department", department)
                .addValue("limit",      limit), this::mapVisitorRow);
    }

    /**
     * Recent entries filtered by location and department.
     * Used by DEPT_HEAD's dashboard "Recent Visitors" widget.
     */
    public List<Visitor> findRecentByLocationAndDepartment(
            String locationId, String department, int limit) {
        String sql = selectVisitorLog(
                "WHERE locationId = :locationId AND department = :department " +
                        "ORDER BY checkInTime DESC LIMIT :limit");
        return jdbc.query(sql, new MapSqlParameterSource()
                .addValue("locationId", locationId)
                .addValue("department", department)
                .addValue("limit",      limit), this::mapVisitorRow);
    }

    // ── Person-to-meet search ─────────────────────────────────────────────────

    /**
     * Public employee search for the appointment booking web app.
     * When {@code locationId} is provided, results are restricted to employees whose
     * {@code worklocation} matches the {@code descriptiveName} of that location.
     * When {@code locationId} is null, all locations are searched.
     * <p>
     * Searches usermaster by fullName, employeeid, or department. Returns ≤ 20 rows.
     */
    public List<PersonToMeetDto> searchAllPersonsPublic(String query, String locationId) {
        if (query == null || query.isBlank()) return java.util.Collections.emptyList();
        String like = "%" + query.trim().toLowerCase() + "%";

        var params = new MapSqlParameterSource("q", like);
        String locationClause = "";
        if (locationId != null && !locationId.isBlank()) {
            locationClause = "AND u.location = :locationId ";
            params.addValue("locationId", locationId);
        }

        String sql = "SELECT u.employeeid, u.fullName, u.phone, u.department, u.designation " +
                     "FROM usermanagement u " +
                     "WHERE (LOWER(u.fullName) LIKE :q " +
                     "    OR LOWER(u.employeeid) LIKE :q " +
                     "    OR LOWER(u.department) LIKE :q) " +
                     locationClause +
                     "ORDER BY u.fullName LIMIT 20";

        return jdbc.query(sql, params,
                (rs, rowNum) -> PersonToMeetDto.builder()
                        .id(rs.getString("employeeid"))
                        .name(rs.getString("fullName"))
                        .phone(rs.getString("phone"))
                        .department(rs.getString("department"))
                        .designation(rs.getString("designation"))
                        .build()
        );
    }

    /** Convenience overload — no location filter (searches all locations). */
    public List<PersonToMeetDto> searchAllPersonsPublic(String query) {
        return searchAllPersonsPublic(query, null);
    }

    /**
     * Searches usermaster employees at the given location.
     * Matches fullName, employeeid, or phone using a case-insensitive LIKE.
     * The location is resolved via locationmaster.descriptiveName = usermaster.worklocation.
     */
    public List<PersonToMeetDto> searchPersonsToMeet(String locationId, String query) {
        String like = "%" + query.trim().toLowerCase() + "%";
        String sql = """
                SELECT um.employeeid, um.fullName, um.phone, um.department, um.designation
                FROM usermanagement um
                WHERE um.location = :locationId
                  AND (
                      LOWER(um.fullName)   LIKE :q
                   OR LOWER(um.employeeid) LIKE :q
                   OR um.phone            LIKE :q
                  )
                ORDER BY um.fullName
                LIMIT 20
                """;
        return jdbc.query(sql, new MapSqlParameterSource()
                .addValue("locationId", locationId)
                .addValue("q",          like),
                (rs, rowNum) -> PersonToMeetDto.builder()
                        .id(rs.getString("employeeid"))
                        .name(rs.getString("fullName"))
                        .phone(rs.getString("phone"))
                        .department(rs.getString("department"))
                        .designation(rs.getString("designation"))
                        .build()
        );
    }

    /**
     * Returns ALL employees at the given location (no search filter).
     * Used by the "Person to Meet" dropdown to populate the full list.
     */
    public List<PersonToMeetDto> findAllPersonsAtLocation(String locationId) {
        String sql = """
                SELECT um.employeeid, um.fullName, um.phone, um.department, um.designation
                FROM usermanagement um
                WHERE um.location = :locationId
                ORDER BY um.fullName
                """;
        return jdbc.query(sql, new MapSqlParameterSource("locationId", locationId),
                (rs, rowNum) -> PersonToMeetDto.builder()
                        .id(rs.getString("employeeid"))
                        .name(rs.getString("fullName"))
                        .phone(rs.getString("phone"))
                        .department(rs.getString("department"))
                        .designation(rs.getString("designation"))
                        .build()
        );
    }

    /**
     * Returns distinct department names from usermaster at the given location.
     * Used to populate the "Host Department" dropdown.
     */
    public List<String> findDistinctDepartmentsAtLocation(String locationId) {
        String sql = """
                SELECT DISTINCT um.department
                FROM usermanagement um
                WHERE um.location = :locationId
                ORDER BY um.department
                """;
        return jdbc.queryForList(sql, new MapSqlParameterSource("locationId", locationId), String.class);
    }

    /**
     * Finds a single employee by ID in usermaster (used to denormalise personName + department).
     */
    public Optional<PersonToMeetDto> findPersonById(String employeeId) {
        String sql = """
                SELECT employeeid, fullName, phone, department, designation
                FROM usermanagement
                WHERE employeeid = :employeeId
                """;
        List<PersonToMeetDto> rows = jdbc.query(sql,
                new MapSqlParameterSource("employeeId", employeeId),
                (rs, rowNum) -> PersonToMeetDto.builder()
                        .id(rs.getString("employeeid"))
                        .name(rs.getString("fullName"))
                        .phone(rs.getString("phone"))
                        .department(rs.getString("department"))
                        .designation(rs.getString("designation"))
                        .build()
        );
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    /** Finds an employee at a specific location (used after HRMS mobile lookup). */
    public Optional<PersonToMeetDto> findPersonByIdAtLocation(String employeeId, String locationId) {
        String sql = """
                SELECT employeeid, fullName, phone, department, designation
                FROM usermanagement
                WHERE employeeid = :employeeId AND location = :locationId
                """;
        List<PersonToMeetDto> rows = jdbc.query(sql,
                new MapSqlParameterSource()
                        .addValue("employeeId", employeeId)
                        .addValue("locationId", locationId),
                (rs, rowNum) -> PersonToMeetDto.builder()
                        .id(rs.getString("employeeid"))
                        .name(rs.getString("fullName"))
                        .phone(rs.getString("phone"))
                        .department(rs.getString("department"))
                        .designation(rs.getString("designation"))
                        .build()
        );
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    /**
     * Returns the visitorId of an already-active (CHECKED_IN) entry for the same person
     * at the same location, or empty if no duplicate exists.
     *
     * For EMPLOYEE entries: matches on empId + locationId.
     * For VISITOR entries:  matches on name (case-insensitive) + mobile + locationId.
     */
    public Optional<String> findActiveCheckin(String entryType, String empId,
                                              String name, String mobile, String locationId) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("locationId", locationId);

        String sql;
        if ("EMPLOYEE".equalsIgnoreCase(entryType) && empId != null) {
            sql = """
                    SELECT visitorId FROM visitorlog
                    WHERE locationId = :locationId
                      AND status IN ('CHECKED_IN','APPROVED','PENDING_APPROVAL')
                      AND empId      = :empId
                    LIMIT 1
                    """;
            params.addValue("empId", empId);
        } else {
            if (name == null || mobile == null) return Optional.empty();
            sql = """
                    SELECT visitorId FROM visitorlog
                    WHERE locationId = :locationId
                      AND status IN ('CHECKED_IN','APPROVED','PENDING_APPROVAL')
                      AND LOWER(name) = LOWER(:name)
                      AND mobile     = :mobile
                    LIMIT 1
                    """;
            params.addValue("name", name);
            params.addValue("mobile", mobile);
        }

        List<String> rows = jdbc.queryForList(sql, params, String.class);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    // ── Dashboard queries ─────────────────────────────────────────────────────

    /**
     * Returns aggregated check-in / check-out / active counts for today,
     * broken down by entry type (EMPLOYEE vs VISITOR).
     *
     * @param locationId restrict to a specific location; null = all locations
     * @param department restrict to a specific department; null = all departments
     */
    public DashboardStatsDto findDashboardStats(String locationId, String department) {
        java.time.LocalDate today = java.time.LocalDate.now();
        LocalDateTime start = today.atStartOfDay();
        LocalDateTime end   = today.plusDays(1).atStartOfDay();

        StringBuilder sql = new StringBuilder();
        sql.append("""
                SELECT
                    SUM(CASE WHEN checkInTime >= :start AND checkInTime < :end THEN 1 ELSE 0 END)                            AS total_checkins,
                    SUM(CASE WHEN checkInTime >= :start AND checkInTime < :end AND entryType = 'EMPLOYEE' THEN 1 ELSE 0 END) AS emp_checkins,
                    SUM(CASE WHEN checkInTime >= :start AND checkInTime < :end AND entryType = 'VISITOR'  THEN 1 ELSE 0 END) AS non_emp_checkins,
                    SUM(CASE WHEN checkInTime >= :start AND checkInTime < :end AND status = 'CHECKED_OUT' THEN 1 ELSE 0 END) AS total_checkouts,
                    SUM(CASE WHEN checkInTime >= :start AND checkInTime < :end AND status = 'CHECKED_OUT' AND entryType = 'EMPLOYEE' THEN 1 ELSE 0 END) AS emp_checkouts,
                    SUM(CASE WHEN checkInTime >= :start AND checkInTime < :end AND status = 'CHECKED_OUT' AND entryType = 'VISITOR'  THEN 1 ELSE 0 END) AS non_emp_checkouts,
                    SUM(CASE WHEN status IN ('CHECKED_IN','APPROVED','PENDING_APPROVAL') THEN 1 ELSE 0 END)                                               AS total_active,
                    SUM(CASE WHEN status IN ('CHECKED_IN','APPROVED','PENDING_APPROVAL') AND entryType = 'EMPLOYEE' THEN 1 ELSE 0 END)                  AS emp_active,
                    SUM(CASE WHEN status IN ('CHECKED_IN','APPROVED','PENDING_APPROVAL') AND entryType = 'VISITOR'  THEN 1 ELSE 0 END)                  AS non_emp_active
                FROM visitorlog
                WHERE 1=1
                """);
        if (locationId != null) sql.append("  AND locationId = :locationId\n");
        if (department != null) sql.append("  AND department = :department\n");

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("start", start)
                .addValue("end",   end);
        if (locationId != null) params.addValue("locationId", locationId);
        if (department != null) params.addValue("department", department);

        DashboardStatsDto result = jdbc.queryForObject(sql.toString(), params, (rs, rowNum) ->
                DashboardStatsDto.builder()
                        .todayCheckinsAll(rs.getLong("total_checkins"))
                        .todayCheckinsEmp(rs.getLong("emp_checkins"))
                        .todayCheckinsNonEmp(rs.getLong("non_emp_checkins"))
                        .todayCheckoutsAll(rs.getLong("total_checkouts"))
                        .todayCheckoutsEmp(rs.getLong("emp_checkouts"))
                        .todayCheckoutsNonEmp(rs.getLong("non_emp_checkouts"))
                        .activeInBuildingAll(rs.getLong("total_active"))
                        .activeInBuildingEmp(rs.getLong("emp_active"))
                        .activeInBuildingNonEmp(rs.getLong("non_emp_active"))
                        .pendingSignouts(rs.getLong("total_active"))
                        .build());

        return result == null ? DashboardStatsDto.builder().build() : result;
    }

    /**
     * Returns per-hour check-in counts for today (only hours with ≥ 1 entry).
     * Used to populate the visitor-flow sparkline on the dashboard.
     *
     * @param locationId restrict to a specific location; null = all locations
     */
    public List<VisitorFlowPointDto> findHourlyFlow(String locationId, String department) {
        java.time.LocalDate today = java.time.LocalDate.now();
        LocalDateTime start = today.atStartOfDay();
        LocalDateTime end   = today.plusDays(1).atStartOfDay();

        StringBuilder sql = new StringBuilder();
        sql.append("""
                SELECT
                    HOUR(checkInTime)                                                    AS hour,
                    COUNT(*)                                                             AS all_count,
                    SUM(CASE WHEN entryType = 'EMPLOYEE' THEN 1 ELSE 0 END)             AS emp_count,
                    SUM(CASE WHEN entryType = 'VISITOR'  THEN 1 ELSE 0 END)             AS non_emp_count
                FROM visitorlog
                WHERE checkInTime >= :start AND checkInTime < :end
                """);
        if (locationId != null) sql.append("  AND locationId = :locationId\n");
        if (department != null) sql.append("  AND department = :department\n");
        sql.append("GROUP BY HOUR(checkInTime)\nORDER BY HOUR(checkInTime)");

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("start", start)
                .addValue("end",   end);
        if (locationId != null) params.addValue("locationId", locationId);
        if (department != null) params.addValue("department", department);

        return jdbc.query(sql.toString(), params, (rs, rowNum) -> VisitorFlowPointDto.builder()
                .label(formatHour(rs.getInt("hour")))
                .all(rs.getLong("all_count"))
                .employee(rs.getLong("emp_count"))
                .nonEmployee(rs.getLong("non_emp_count"))
                .build());
    }

    private static String formatHour(int hour) {
        if (hour == 0)  return "12am";
        if (hour < 12)  return hour + "am";
        if (hour == 12) return "12pm";
        return (hour - 12) + "pm";
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private Visitor mapVisitorRow(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
        String govtIdTypeStr = rs.getString("govtIdType");
        return Visitor.builder()
                .visitorId(rs.getString("visitorId"))
                .visitType(VisitType.valueOf(rs.getString("visitType")))
                .groupId(safeGetString(rs, "groupId"))
                .entryType(EntryType.valueOf(rs.getString("entryType")))
                .name(rs.getString("name"))
                .mobile(rs.getString("mobile"))
                .empId(rs.getString("empId"))
                .status(VisitStatus.valueOf(rs.getString("status")))
                .personToMeet(rs.getString("personToMeet"))
                .personName(rs.getString("personName"))
                .personToMeetPhone(safeGetString(rs, "personToMeetPhone"))
                .department(rs.getString("department"))
                .locationId(rs.getString("locationId"))
                .cardNumber(rs.getObject("cardNumber", Integer.class))
                .govtIdType(govtIdTypeStr != null ? GovtIdType.valueOf(govtIdTypeStr) : null)
                .govtIdNumber(rs.getString("govtIdNumber"))
                .checkInTime(rs.getTimestamp("checkInTime") != null
                        ? rs.getTimestamp("checkInTime").toLocalDateTime() : null)
                .checkOutTime(rs.getTimestamp("checkOutTime") != null
                        ? rs.getTimestamp("checkOutTime").toLocalDateTime() : null)
                .approvedAt(safeGetTimestamp(rs, "approvedAt"))
                .rejectedAt(safeGetTimestamp(rs, "rejectedAt"))
                .rejectionRemarks(safeGetString(rs, "rejectionRemarks"))
                .reasonForVisit(rs.getString("reasonForVisit"))
                .companyName(safeGetString(rs, "companyName"))
                .createdBy(rs.getString("createdBy"))
                .workstationMac(safeGetString(rs, "workstationMac"))
                .checkInDeviceId(safeGetString(rs, "checkInDeviceId"))
                .lastScanDeviceId(safeGetString(rs, "lastScanDeviceId"))
                .lastScanAt(safeGetTimestamp(rs, "lastScanAt"))
                .build();
    }

    /** Safely reads a column that might not be in the result set yet (pre-migration rows). */
    private static String safeGetString(java.sql.ResultSet rs, String col) {
        try { return rs.getString(col); } catch (Exception e) { return null; }
    }

    private static java.time.LocalDateTime safeGetTimestamp(java.sql.ResultSet rs, String col) {
        try {
            java.sql.Timestamp ts = rs.getTimestamp(col);
            return ts != null ? ts.toLocalDateTime() : null;
        } catch (Exception e) {
            return null;
        }
    }
}
