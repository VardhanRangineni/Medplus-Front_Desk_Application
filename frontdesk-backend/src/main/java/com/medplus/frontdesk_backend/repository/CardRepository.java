package com.medplus.frontdesk_backend.repository;

import com.medplus.frontdesk_backend.dto.CardDto;
import com.medplus.frontdesk_backend.dto.CardRequestDto;
import com.medplus.frontdesk_backend.dto.CardStatsDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Repository
@RequiredArgsConstructor
public class CardRepository {

    private final NamedParameterJdbcTemplate jdbc;

    // ── Card queries ─────────────────────────────────────────────────────────

    /**
     * Finds and locks the next AVAILABLE card for a location (uses SELECT FOR UPDATE).
     * Returns empty if no cards are available.
     */
    public Optional<CardDto> findNextAvailable(String locationId) {
        List<CardDto> rows = jdbc.query(
            "SELECT c.id, c.locationId, c.cardCode, c.status, c.assignedTo, c.assignedAt, c.createdAt, " +
            "       lm.descriptiveName AS locationName " +
            "FROM cardmaster c " +
            "JOIN locationmaster lm ON lm.LocationId = c.locationId " +
            "WHERE c.locationId = :loc AND c.status = 'AVAILABLE' " +
            "ORDER BY c.id LIMIT 1 FOR UPDATE",
            new MapSqlParameterSource("loc", locationId),
            CardRepository::mapCard
        );
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    /** Assigns a card to a visitor. */
    public void assignCard(long cardId, String visitorId) {
        jdbc.update(
            "UPDATE cardmaster SET status = 'ASSIGNED', assignedTo = :vid, assignedAt = :now " +
            "WHERE id = :id AND status = 'AVAILABLE'",
            new MapSqlParameterSource()
                .addValue("vid", visitorId)
                .addValue("now", Timestamp.valueOf(LocalDateTime.now()))
                .addValue("id", cardId)
        );
    }

    /** Releases a card back to AVAILABLE when returned by the visitor. */
    public void releaseCard(String cardCode) {
        jdbc.update(
            "UPDATE cardmaster SET status = 'AVAILABLE', assignedTo = NULL, assignedAt = NULL " +
            "WHERE cardCode = :code",
            new MapSqlParameterSource("code", cardCode)
        );
    }

    /** Marks a card as MISSING (not returned at checkout). */
    public void markMissing(String cardCode) {
        jdbc.update(
            "UPDATE cardmaster SET status = 'MISSING', assignedTo = NULL, assignedAt = NULL " +
            "WHERE cardCode = :code",
            new MapSqlParameterSource("code", cardCode)
        );
    }

    /** Restores a MISSING card to AVAILABLE (admin action). */
    public void restoreCard(long cardId) {
        jdbc.update(
            "UPDATE cardmaster SET status = 'AVAILABLE', assignedTo = NULL, assignedAt = NULL " +
            "WHERE id = :id AND status = 'MISSING'",
            new MapSqlParameterSource("id", cardId)
        );
    }

    /** Returns stats (total/available/assigned/missing) for each location. */
    public List<CardStatsDto> getStats(String locationId) {
        MapSqlParameterSource params = new MapSqlParameterSource();
        String where = "";
        if (locationId != null && !locationId.isBlank()) {
            where = "WHERE c.locationId = :loc ";
            params.addValue("loc", locationId);
        }
        return jdbc.query(
            "SELECT c.locationId, lm.descriptiveName AS locationName, " +
            "       COUNT(*) AS total, " +
            "       SUM(c.status = 'AVAILABLE') AS available, " +
            "       SUM(c.status = 'ASSIGNED')  AS assigned, " +
            "       SUM(c.status = 'MISSING')   AS missing " +
            "FROM cardmaster c " +
            "JOIN locationmaster lm ON lm.LocationId = c.locationId " +
            where +
            "GROUP BY c.locationId, lm.descriptiveName " +
            "ORDER BY lm.descriptiveName",
            params,
            (rs, rn) -> CardStatsDto.builder()
                .locationId(rs.getString("locationId"))
                .locationName(rs.getString("locationName"))
                .total(rs.getInt("total"))
                .available(rs.getInt("available"))
                .assigned(rs.getInt("assigned"))
                .missing(rs.getInt("missing"))
                .build()
        );
    }

    /** Paginated list of cards, optionally filtered by location and/or status. */
    public List<CardDto> findCards(String locationId, String status, int offset, int limit) {
        MapSqlParameterSource params = new MapSqlParameterSource()
            .addValue("offset", offset)
            .addValue("limit", limit);
        StringBuilder where = new StringBuilder("WHERE 1=1 ");
        if (locationId != null && !locationId.isBlank()) {
            where.append("AND c.locationId = :loc ");
            params.addValue("loc", locationId);
        }
        if (status != null && !status.isBlank()) {
            where.append("AND c.status = :status ");
            params.addValue("status", status.toUpperCase());
        }
        return jdbc.query(
            "SELECT c.id, c.locationId, c.cardCode, c.status, c.assignedTo, c.assignedAt, c.createdAt, " +
            "       lm.descriptiveName AS locationName, vl.name AS assignedToName " +
            "FROM cardmaster c " +
            "JOIN locationmaster lm ON lm.LocationId = c.locationId " +
            "LEFT JOIN visitorlog vl ON vl.visitorId = c.assignedTo AND vl.status = 'CHECKED_IN' " +
            where +
            "ORDER BY c.locationId, c.id " +
            "LIMIT :limit OFFSET :offset",
            params,
            CardRepository::mapCard
        );
    }

    public long countCards(String locationId, String status) {
        MapSqlParameterSource params = new MapSqlParameterSource();
        StringBuilder where = new StringBuilder("WHERE 1=1 ");
        if (locationId != null && !locationId.isBlank()) {
            where.append("AND c.locationId = :loc ");
            params.addValue("loc", locationId);
        }
        if (status != null && !status.isBlank()) {
            where.append("AND c.status = :status ");
            params.addValue("status", status.toUpperCase());
        }
        Long n = jdbc.queryForObject(
            "SELECT COUNT(*) FROM cardmaster c " + where, params, Long.class);
        return n == null ? 0L : n;
    }

    /** Finds a card by its code. */
    public Optional<CardDto> findByCode(String cardCode) {
        List<CardDto> rows = jdbc.query(
            "SELECT c.id, c.locationId, c.cardCode, c.status, c.assignedTo, c.assignedAt, c.createdAt, " +
            "       lm.descriptiveName AS locationName, vl.name AS assignedToName " +
            "FROM cardmaster c " +
            "JOIN locationmaster lm ON lm.LocationId = c.locationId " +
            "LEFT JOIN visitorlog vl ON vl.visitorId = c.assignedTo " +
            "WHERE c.cardCode = :code",
            new MapSqlParameterSource("code", cardCode),
            CardRepository::mapCard
        );
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    /**
     * Returns the next sequence number for a location, so new cards don't overlap.
     * Parses the integer at the end of existing card codes.
     */
    public int nextSequenceForLocation(String locationId) {
        String sql =
            "SELECT MAX(CAST(SUBSTRING_INDEX(cardCode, '-', -1) AS UNSIGNED)) " +
            "FROM cardmaster WHERE locationId = :loc";
        Integer max = jdbc.queryForObject(sql,
            new MapSqlParameterSource("loc", locationId), Integer.class);
        return (max == null ? 0 : max) + 1;
    }

    /** Bulk inserts new card records and links them to a request batch. */
    public void insertCards(String locationId, String locationAbbrev, int startSeq, int count, Long requestId) {
        for (int i = startSeq; i < startSeq + count; i++) {
            String code = locationAbbrev + "-VISITOR-" + i;
            jdbc.update(
                "INSERT IGNORE INTO cardmaster (locationId, cardCode, status, requestId) " +
                "VALUES (:loc, :code, 'AVAILABLE', :rid)",
                new MapSqlParameterSource()
                    .addValue("loc", locationId)
                    .addValue("code", code)
                    .addValue("rid", requestId)
            );
        }
    }

    /** Creates an INITIAL (auto-generated) card request marked FULFILLED. Returns the new id. */
    public long insertInitialRequest(String locationId, int quantity) {
        var keyHolder = new GeneratedKeyHolder();
        jdbc.update(
            "INSERT INTO cardrequests " +
            "(locationId, requestType, quantity, notes, status, requestedBy, requestedAt, fulfilledAt, fulfilledBy) " +
            "VALUES (:loc, 'INITIAL', :qty, 'Auto-generated initial card batch', " +
            "        'FULFILLED', 'SYSTEM', NOW(), NOW(), 'SYSTEM')",
            new MapSqlParameterSource()
                .addValue("loc", locationId)
                .addValue("qty", quantity),
            keyHolder
        );
        return keyHolder.getKey().longValue();
    }

    /** Returns all card codes belonging to a specific request batch. */
    public List<String> findCardCodesByRequestId(long requestId) {
        return jdbc.queryForList(
            "SELECT cardCode FROM cardmaster WHERE requestId = :rid ORDER BY id",
            new MapSqlParameterSource("rid", requestId),
            String.class
        );
    }

    /**
     * Fallback: finds card codes created within a 5-minute window of a fulfillment timestamp.
     * Used when cards were inserted before the requestId tracking column existed, causing them
     * to be linked to the INITIAL batch by the migration instead of to their actual request.
     * Does NOT filter by requestId so it finds cards regardless of what batch they were assigned to.
     */
    public List<String> findCardCodesByFulfillmentWindow(String locationId, Timestamp fulfilledAt) {
        return jdbc.queryForList(
            "SELECT cardCode FROM cardmaster " +
            "WHERE locationId = :loc " +
            "AND createdAt >= DATE_SUB(:ts, INTERVAL 30 SECOND) " +
            "AND createdAt <= DATE_ADD(:ts, INTERVAL 5 MINUTE) " +
            "ORDER BY id",
            new MapSqlParameterSource()
                .addValue("loc", locationId)
                .addValue("ts", fulfilledAt),
            String.class
        );
    }

    /** Marks a card request as downloaded (sets downloadedAt = NOW()). */
    public void markDownloaded(long requestId) {
        jdbc.update(
            "UPDATE cardrequests SET downloadedAt = NOW() WHERE id = :id",
            new MapSqlParameterSource("id", requestId)
        );
    }

    // ── Card request queries ─────────────────────────────────────────────────

    /** Creates a new card request and returns the generated id. */
    public long createRequest(String locationId, String requestType,
                              int quantity, String notes, String requestedBy) {
        var keyHolder = new GeneratedKeyHolder();
        jdbc.update(
            "INSERT INTO cardrequests (locationId, requestType, quantity, notes, requestedBy) " +
            "VALUES (:loc, :type, :qty, :notes, :by)",
            new MapSqlParameterSource()
                .addValue("loc",   locationId)
                .addValue("type",  requestType.toUpperCase())
                .addValue("qty",   quantity)
                .addValue("notes", notes)
                .addValue("by",    requestedBy),
            keyHolder
        );
        return keyHolder.getKey().longValue();
    }

    public List<CardRequestDto> findRequests(String locationId, String status) {
        MapSqlParameterSource params = new MapSqlParameterSource();
        StringBuilder where = new StringBuilder("WHERE 1=1 ");
        if (locationId != null && !locationId.isBlank()) {
            where.append("AND cr.locationId = :loc ");
            params.addValue("loc", locationId);
        }
        if (status != null && !status.isBlank()) {
            where.append("AND cr.status = :status ");
            params.addValue("status", status.toUpperCase());
        }
        return jdbc.query(
            "SELECT cr.id, cr.locationId, lm.descriptiveName AS locationName, " +
            "       cr.requestType, cr.quantity, cr.notes, cr.status, " +
            "       cr.requestedBy, cr.requestedAt, cr.fulfilledAt, cr.fulfilledBy, cr.downloadedAt " +
            "FROM cardrequests cr " +
            "JOIN locationmaster lm ON lm.LocationId = cr.locationId " +
            where + "ORDER BY cr.requestedAt DESC",
            params,
            (rs, rn) -> CardRequestDto.builder()
                .id(rs.getLong("id"))
                .locationId(rs.getString("locationId"))
                .locationName(rs.getString("locationName"))
                .requestType(rs.getString("requestType"))
                .quantity(rs.getInt("quantity"))
                .notes(rs.getString("notes"))
                .status(rs.getString("status"))
                .requestedBy(rs.getString("requestedBy"))
                .requestedAt(toLocalDateTime(rs.getTimestamp("requestedAt")))
                .fulfilledAt(toLocalDateTime(rs.getTimestamp("fulfilledAt")))
                .fulfilledBy(rs.getString("fulfilledBy"))
                .downloadedAt(toLocalDateTime(rs.getTimestamp("downloadedAt")))
                .build()
        );
    }

    public Optional<Map<String, Object>> findRequestById(long id) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT * FROM cardrequests WHERE id = :id",
            new MapSqlParameterSource("id", id)
        );
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    public void updateRequestStatus(long id, String status, String fulfilledBy) {
        MapSqlParameterSource params = new MapSqlParameterSource()
            .addValue("id",     id)
            .addValue("status", status)
            .addValue("by",     fulfilledBy);
        String fulfilledAtSql = "FULFILLED".equals(status)
            ? ", fulfilledAt = NOW(), fulfilledBy = :by "
            : " ";
        jdbc.update(
            "UPDATE cardrequests SET status = :status" + fulfilledAtSql + "WHERE id = :id",
            params
        );
    }

    // ── Mapper ───────────────────────────────────────────────────────────────

    private static CardDto mapCard(java.sql.ResultSet rs, int rn) throws java.sql.SQLException {
        var meta = rs.getMetaData();
        String assignedToName = null;
        for (int i = 1; i <= meta.getColumnCount(); i++) {
            if ("assignedToName".equalsIgnoreCase(meta.getColumnLabel(i))) {
                assignedToName = rs.getString("assignedToName");
                break;
            }
        }
        return CardDto.builder()
            .id(rs.getLong("id"))
            .locationId(rs.getString("locationId"))
            .locationName(rs.getString("locationName"))
            .cardCode(rs.getString("cardCode"))
            .status(rs.getString("status"))
            .assignedTo(rs.getString("assignedTo"))
            .assignedToName(assignedToName)
            .assignedAt(toLocalDateTime(rs.getTimestamp("assignedAt")))
            .createdAt(toLocalDateTime(rs.getTimestamp("createdAt")))
            .build();
    }

    private static LocalDateTime toLocalDateTime(java.sql.Timestamp ts) {
        return ts == null ? null : ts.toLocalDateTime();
    }
}
