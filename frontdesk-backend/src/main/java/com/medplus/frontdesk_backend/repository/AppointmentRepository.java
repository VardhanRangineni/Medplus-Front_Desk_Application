package com.medplus.frontdesk_backend.repository;

import com.medplus.frontdesk_backend.model.AppointmentLog;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Date;
import java.sql.Time;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

@Slf4j
@Repository
@RequiredArgsConstructor
public class AppointmentRepository {

    private final NamedParameterJdbcTemplate jdbc;

    // ── Write ─────────────────────────────────────────────────────────────────

    /** Persists a new appointment booking. */
    public void insert(AppointmentLog a) {
        jdbc.update(
            "INSERT INTO appointmentslog " +
            "(appointmentId, bookingToken, entryType, name, aadhaarNumber, email, mobile, empId, " +
            " personToMeet, personName, department, locationId, locationName, " +
            " appointmentDate, appointmentTime, reasonForVisit) " +
            "VALUES (:appointmentId, :bookingToken, :entryType, :name, :aadhaarNumber, :email, :mobile, :empId, " +
            "        :personToMeet, :personName, :department, :locationId, :locationName, " +
            "        :appointmentDate, :appointmentTime, :reasonForVisit)",
            new MapSqlParameterSource()
                .addValue("appointmentId",  a.getAppointmentId())
                .addValue("bookingToken",   a.getBookingToken())
                .addValue("entryType",      a.getEntryType())
                .addValue("name",           a.getName())
                .addValue("aadhaarNumber",  a.getAadhaarNumber())
                .addValue("email",          a.getEmail())
                .addValue("mobile",         a.getMobile())
                .addValue("empId",          a.getEmpId())
                .addValue("personToMeet",   a.getPersonToMeet())
                .addValue("personName",     a.getPersonName())
                .addValue("department",     a.getDepartment())
                .addValue("locationId",     a.getLocationId())
                .addValue("locationName",   a.getLocationName())
                .addValue("appointmentDate",a.getAppointmentDate() != null ? Date.valueOf(a.getAppointmentDate()) : null)
                .addValue("appointmentTime",a.getAppointmentTime() != null ? Time.valueOf(a.getAppointmentTime()) : null)
                .addValue("reasonForVisit", a.getReasonForVisit())
        );
    }

    /** Removes an appointment by ID (called after successful check-in). */
    public void delete(String appointmentId) {
        jdbc.update(
            "DELETE FROM appointmentslog WHERE appointmentId = :id",
            new MapSqlParameterSource("id", appointmentId)
        );
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    /** Finds a single appointment by its human-readable reference ID. */
    public Optional<AppointmentLog> findById(String appointmentId) {
        List<AppointmentLog> rows = jdbc.query(
            "SELECT * FROM appointmentslog WHERE appointmentId = :id",
            new MapSqlParameterSource("id", appointmentId),
            AppointmentRepository::mapRow
        );
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    /** Finds a single appointment by its UUID booking token (for web-app confirmation polling). */
    public Optional<AppointmentLog> findByToken(String bookingToken) {
        List<AppointmentLog> rows = jdbc.query(
            "SELECT * FROM appointmentslog WHERE bookingToken = :token",
            new MapSqlParameterSource("token", bookingToken),
            AppointmentRepository::mapRow
        );
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    /**
     * Paginated appointment list with DB-level filtering.
     *
     * @param defaultView  when true, applies "today from current time onwards" as the base filter
     * @param from         explicit date-range start (ignored when defaultView=true)
     * @param to           explicit date-range end   (ignored when defaultView=true)
     * @param search       wildcard term applied to name / mobile / personName / appointmentId
     * @param locationId   location restriction (null = all locations, admin only)
     * @param page         0-based page index
     * @param size         records per page
     */
    public List<AppointmentLog> findPage(boolean defaultView,
                                         LocalDate from, LocalDate to,
                                         String search, String locationId,
                                         int page, int size) {
        var params = new MapSqlParameterSource();
        String where = buildWhere(defaultView, from, to, search, locationId, params);
        String sql = "SELECT * FROM appointmentslog " + where +
                     " ORDER BY appointmentDate, appointmentTime" +
                     " LIMIT :size OFFSET :offset";
        params.addValue("size",   size);
        params.addValue("offset", page * size);
        return jdbc.query(sql, params, AppointmentRepository::mapRow);
    }

    /** Returns the total row count matching the same filters (for pagination metadata). */
    public int count(boolean defaultView,
                     LocalDate from, LocalDate to,
                     String search, String locationId) {
        var params = new MapSqlParameterSource();
        String where = buildWhere(defaultView, from, to, search, locationId, params);
        String sql = "SELECT COUNT(*) FROM appointmentslog " + where;
        Integer n = jdbc.queryForObject(sql, params, Integer.class);
        return n == null ? 0 : n;
    }

    /**
     * Returns the MAX daily sequence already used for the given date prefix
     * (e.g. "20260416"), so the caller can generate the next unique appointmentId.
     */
    public int maxSequenceForDate(String compact) {
        String prefix = "APT-" + compact + "-%";
        String sql =
            "SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(appointmentId, '-', -1) AS UNSIGNED)), 0) " +
            "FROM appointmentslog WHERE appointmentId LIKE :prefix";
        Integer n = jdbc.queryForObject(sql, new MapSqlParameterSource("prefix", prefix), Integer.class);
        return n == null ? 0 : n;
    }

    /** Returns true when the appointmentslog table contains no rows. Used for seeding. */
    public boolean isEmpty() {
        Integer n = jdbc.queryForObject(
            "SELECT COUNT(*) FROM appointmentslog",
            new MapSqlParameterSource(),
            Integer.class
        );
        return n == null || n == 0;
    }

    /**
     * Returns the appointment times already booked for a given doctor on a given date.
     * Times are returned as display strings (e.g. "04:00 PM") to match the slot labels
     * sent by the booking web app.
     */
    public java.util.Set<String> findBookedTimes(LocalDate date, String personToMeet) {
        List<String> rows = jdbc.query(
            "SELECT TIME_FORMAT(appointmentTime, '%h:%i %p') FROM appointmentslog " +
            "WHERE appointmentDate = :date AND personToMeet = :ptm",
            new MapSqlParameterSource()
                .addValue("date", Date.valueOf(date))
                .addValue("ptm",  personToMeet),
            (rs, n) -> rs.getString(1).toUpperCase()
        );
        return new java.util.LinkedHashSet<>(rows);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private static String buildWhere(boolean defaultView,
                                      LocalDate from, LocalDate to,
                                      String search, String locationId,
                                      MapSqlParameterSource params) {
        var sb = new StringBuilder("WHERE 1=1");

        if (defaultView) {
            sb.append(" AND (appointmentDate > CURDATE() " +
                      "OR (appointmentDate = CURDATE() AND appointmentTime >= CURTIME()))");
        } else {
            if (from != null) {
                sb.append(" AND appointmentDate >= :from");
                params.addValue("from", Date.valueOf(from));
            }
            if (to != null) {
                sb.append(" AND appointmentDate <= :to");
                params.addValue("to", Date.valueOf(to));
            }
        }

        if (locationId != null && !locationId.isBlank()) {
            sb.append(" AND locationId = :locationId");
            params.addValue("locationId", locationId);
        }

        if (search != null && !search.isBlank()) {
            String q = "%" + search.trim() + "%";
            sb.append(" AND (name LIKE :q OR mobile LIKE :q OR personName LIKE :q OR appointmentId LIKE :q)");
            params.addValue("q", q);
        }

        return sb.toString();
    }

    private static AppointmentLog mapRow(java.sql.ResultSet rs, int n) throws java.sql.SQLException {
        Time t = rs.getTime("appointmentTime");
        Date d = rs.getDate("appointmentDate");
        Timestamp ca = rs.getTimestamp("createdAt");
        return AppointmentLog.builder()
                .appointmentId  (rs.getString("appointmentId"))
                .bookingToken   (rs.getString("bookingToken"))
                .entryType      (rs.getString("entryType"))
                .name           (rs.getString("name"))
                .aadhaarNumber  (rs.getString("aadhaarNumber"))
                .email          (rs.getString("email"))
                .mobile         (rs.getString("mobile"))
                .empId          (rs.getString("empId"))
                .personToMeet   (rs.getString("personToMeet"))
                .personName     (rs.getString("personName"))
                .department     (rs.getString("department"))
                .locationId     (rs.getString("locationId"))
                .locationName   (rs.getString("locationName"))
                .appointmentDate(d  != null ? d.toLocalDate()      : null)
                .appointmentTime(t  != null ? t.toLocalTime()      : null)
                .reasonForVisit (rs.getString("reasonForVisit"))
                .createdAt      (ca != null ? ca.toLocalDateTime() : null)
                .build();
    }
}
