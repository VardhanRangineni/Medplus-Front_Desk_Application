package com.medplus.frontdesk_backend.repository;

import com.medplus.frontdesk_backend.model.BusySlot;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * JDBC repository for {@code busy_slots}.
 *
 * <p>Kept deliberately small — CRUD plus the two overlap queries the
 * availability and calendar-sync flows need.
 */
@Repository
@RequiredArgsConstructor
public class BusySlotRepository {

    private final NamedParameterJdbcTemplate jdbc;

    // ── Write ─────────────────────────────────────────────────────────────────

    public void insert(BusySlot s) {
        jdbc.update(
            "INSERT INTO busy_slots " +
            "(id, employeeId, startTime, endTime, reason, zimbraEventId, createdBy) " +
            "VALUES (:id, :employeeId, :startTime, :endTime, :reason, :zimbraEventId, :createdBy)",
            new MapSqlParameterSource()
                .addValue("id",            s.getId())
                .addValue("employeeId",    s.getEmployeeId())
                .addValue("startTime",     Timestamp.valueOf(s.getStartTime()))
                .addValue("endTime",       Timestamp.valueOf(s.getEndTime()))
                .addValue("reason",        s.getReason())
                .addValue("zimbraEventId", s.getZimbraEventId())
                .addValue("createdBy",     s.getCreatedBy())
        );
    }

    public int deleteById(String id) {
        return jdbc.update(
            "DELETE FROM busy_slots WHERE id = :id",
            new MapSqlParameterSource("id", id)
        );
    }

    /** Stamps the remote Zimbra event id after a successful calendar sync. */
    public int setZimbraEventId(String id, String zimbraEventId) {
        return jdbc.update(
            "UPDATE busy_slots SET zimbraEventId = :zid WHERE id = :id",
            new MapSqlParameterSource()
                .addValue("id",  id)
                .addValue("zid", zimbraEventId)
        );
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    public Optional<BusySlot> findById(String id) {
        List<BusySlot> rows = jdbc.query(
            "SELECT * FROM busy_slots WHERE id = :id",
            new MapSqlParameterSource("id", id),
            BusySlotRepository::mapRow
        );
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    /** Returns every block owned by {@code employeeId} whose window overlaps [from,to]. */
    public List<BusySlot> findByEmployeeInRange(String employeeId,
                                                LocalDateTime from,
                                                LocalDateTime to) {
        return jdbc.query(
            "SELECT * FROM busy_slots " +
            " WHERE employeeId = :employeeId " +
            "   AND startTime < :to " +
            "   AND endTime   > :from " +
            " ORDER BY startTime",
            new MapSqlParameterSource()
                .addValue("employeeId", employeeId)
                .addValue("from",       Timestamp.valueOf(from))
                .addValue("to",         Timestamp.valueOf(to)),
            BusySlotRepository::mapRow
        );
    }

    /**
     * Counts active busy blocks overlapping the given window — the core
     * availability check. Cheap: uses the composite index on
     * (employeeId, startTime, endTime).
     */
    public int countOverlapping(String employeeId,
                                LocalDateTime start,
                                LocalDateTime end) {
        Integer n = jdbc.queryForObject(
            "SELECT COUNT(*) FROM busy_slots " +
            " WHERE employeeId = :employeeId " +
            "   AND startTime < :end " +
            "   AND endTime   > :start",
            new MapSqlParameterSource()
                .addValue("employeeId", employeeId)
                .addValue("start",      Timestamp.valueOf(start))
                .addValue("end",        Timestamp.valueOf(end)),
            Integer.class
        );
        return n == null ? 0 : n;
    }

    // ── Row mapper ────────────────────────────────────────────────────────────

    private static BusySlot mapRow(java.sql.ResultSet rs, int n) throws java.sql.SQLException {
        Timestamp start = rs.getTimestamp("startTime");
        Timestamp end   = rs.getTimestamp("endTime");
        Timestamp ca    = rs.getTimestamp("createdAt");
        return BusySlot.builder()
                .id            (rs.getString("id"))
                .employeeId    (rs.getString("employeeId"))
                .startTime     (start != null ? start.toLocalDateTime() : null)
                .endTime       (end   != null ? end.toLocalDateTime()   : null)
                .reason        (rs.getString("reason"))
                .zimbraEventId (rs.getString("zimbraEventId"))
                .createdBy     (rs.getString("createdBy"))
                .createdAt     (ca != null ? ca.toLocalDateTime() : null)
                .build();
    }
}
