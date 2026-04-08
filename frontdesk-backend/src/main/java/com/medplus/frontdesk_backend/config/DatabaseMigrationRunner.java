package com.medplus.frontdesk_backend.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Runs idempotent schema migrations on every startup, after the DataSource
 * is fully initialised (schema-init.sql + data.sql have already been applied).
 *
 * Why not schema-init.sql?
 *   MySQL does not support ALTER TABLE ... ADD COLUMN IF NOT EXISTS.
 *   Doing it in Java gives us proper existence checks with zero SQL-escaping risk.
 *
 * Add new migrations as private methods and call them from run().
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DatabaseMigrationRunner implements ApplicationRunner {

    private final JdbcTemplate jdbc;

    @Override
    public void run(ApplicationArguments args) {
        log.info("Running database migrations...");
        addColumnIfMissing("visitorlog", "govtIdType",
                "ENUM('AADHAAR','PAN','PASSPORT','VOTER','DL') DEFAULT NULL " +
                "COMMENT 'Government-issued ID type'",
                "AFTER `cardNumber`");
        addColumnIfMissing("visitorlog", "govtIdNumber",
                "VARCHAR(60) DEFAULT NULL " +
                "COMMENT 'Government ID number (masked or full)'",
                "AFTER `govtIdType`");
        addColumnIfMissing("visitorlog", "imageUrl",
                "VARCHAR(500) DEFAULT NULL " +
                "COMMENT 'Visitor photo URL — local path now, swap to cloud storage URL when ready'",
                "AFTER `govtIdNumber`");
        addColumnIfMissing("visitorlog", "cardCode",
                "VARCHAR(50) DEFAULT NULL " +
                "COMMENT 'Auto-assigned card code from cardmaster, e.g. MSOH-VISITOR-1'",
                "AFTER `cardNumber`");
        addColumnIfMissing("visitormember", "cardCode",
                "VARCHAR(50) DEFAULT NULL " +
                "COMMENT 'Auto-assigned card code from cardmaster'",
                "AFTER `cardNumber`");
        createPreRegistrationTables();
        addColumnIfMissing("preregistrations", "govtIdType",
                "VARCHAR(20) DEFAULT NULL COMMENT 'e.g. AADHAAR, PAN'",
                "AFTER `email`");
        addColumnIfMissing("preregistrations", "govtIdNumber",
                "VARCHAR(60) DEFAULT NULL COMMENT 'Government ID number as entered by visitor'",
                "AFTER `govtIdType`");
        createCardTables();
        addColumnIfMissing("cardmaster", "requestId",
                "BIGINT DEFAULT NULL COMMENT 'FK → cardrequests.id — batch that created this card'",
                "AFTER `createdAt`");
        addColumnIfMissing("cardrequests", "downloadedAt",
                "DATETIME DEFAULT NULL COMMENT 'When the PDF for this batch was downloaded; NULL = not yet downloaded'",
                "AFTER `fulfilledBy`");
        extendRequestTypeEnum();
        seedCardsForExistingLocations();
        seedInitialCardRequests();
        log.info("Database migrations complete.");
    }

    private void createCardTables() {
        jdbc.execute(
            "CREATE TABLE IF NOT EXISTS `cardmaster` (" +
            "  `id`         BIGINT      NOT NULL AUTO_INCREMENT," +
            "  `locationId` VARCHAR(50) NOT NULL COMMENT 'FK → locationmaster.LocationId'," +
            "  `cardCode`   VARCHAR(50) NOT NULL COMMENT 'Unique card code, e.g. MSOH-VISITOR-1'," +
            "  `status`     ENUM('AVAILABLE','ASSIGNED','MISSING') NOT NULL DEFAULT 'AVAILABLE'," +
            "  `assignedTo` VARCHAR(20)  DEFAULT NULL COMMENT 'visitorId currently holding this card'," +
            "  `assignedAt` TIMESTAMP    DEFAULT NULL," +
            "  `createdAt`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP," +
            "  PRIMARY KEY (`id`)," +
            "  UNIQUE KEY `uk_cardmaster_code` (`cardCode`)," +
            "  KEY `idx_cardmaster_loc_status` (`locationId`, `status`)," +
            "  KEY `fk_cardmaster_location` (`locationId`)," +
            "  CONSTRAINT `fk_cardmaster_location`" +
            "    FOREIGN KEY (`locationId`) REFERENCES `locationmaster` (`LocationId`)" +
            ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4" +
            "  COMMENT='Physical visitor card inventory per location'"
        );

        jdbc.execute(
            "CREATE TABLE IF NOT EXISTS `cardrequests` (" +
            "  `id`           BIGINT       NOT NULL AUTO_INCREMENT," +
            "  `locationId`   VARCHAR(50)  NOT NULL COMMENT 'FK → locationmaster.LocationId'," +
            "  `requestType`  ENUM('ADDITIONAL','REPLACEMENT') NOT NULL," +
            "  `quantity`     INT          NOT NULL," +
            "  `notes`        TEXT         DEFAULT NULL," +
            "  `status`       ENUM('PENDING','FULFILLED','CANCELLED') NOT NULL DEFAULT 'PENDING'," +
            "  `requestedBy`  VARCHAR(100) NOT NULL," +
            "  `requestedAt`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP," +
            "  `fulfilledAt`  TIMESTAMP    DEFAULT NULL," +
            "  `fulfilledBy`  VARCHAR(100) DEFAULT NULL," +
            "  PRIMARY KEY (`id`)," +
            "  KEY `idx_cardrequests_loc_status` (`locationId`, `status`)," +
            "  KEY `fk_cardrequests_location` (`locationId`)," +
            "  CONSTRAINT `fk_cardrequests_location`" +
            "    FOREIGN KEY (`locationId`) REFERENCES `locationmaster` (`LocationId`)" +
            ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4" +
            "  COMMENT='Requests for additional or replacement physical visitor cards'"
        );
        log.info("Card tables ensured.");
    }

    /**
     * For every location that has no cards yet, generate the default 100.
     * Safe to call on every startup — the SELECT before INSERT prevents duplicates.
     */
    private void seedCardsForExistingLocations() {
        var locations = jdbc.queryForList(
            "SELECT LocationId, descriptiveName FROM locationmaster");
        for (var row : locations) {
            String locId   = (String) row.get("LocationId");
            String locName = (String) row.get("descriptiveName");
            Integer count  = jdbc.queryForObject(
                "SELECT COUNT(*) FROM cardmaster WHERE locationId = ?",
                Integer.class, locId);
            if (count != null && count == 0) {
                generateCardsForLocation(locId, locName, 1, 100);
                log.info("Seeded 100 cards for location: {}", locId);
            }
        }
    }

    /**
     * Generates {@code count} sequential card records starting at {@code startSeq},
     * using the first-letter abbreviation of the location's descriptive name.
     */
    public static String locationAbbreviation(String descriptiveName) {
        if (descriptiveName == null || descriptiveName.isBlank()) return "LOC";
        String[] words = descriptiveName.trim().split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (String w : words) {
            if (!w.isEmpty()) sb.append(Character.toUpperCase(w.charAt(0)));
        }
        return sb.toString();
    }

    void generateCardsForLocation(String locationId, String descriptiveName, int startSeq, int count) {
        String abbrev = locationAbbreviation(descriptiveName);
        for (int i = startSeq; i < startSeq + count; i++) {
            String code = abbrev + "-VISITOR-" + i;
            jdbc.update(
                "INSERT IGNORE INTO cardmaster (locationId, cardCode, status) VALUES (?, ?, 'AVAILABLE')",
                locationId, code);
        }
    }

    private void createPreRegistrationTables() {
        jdbc.execute(
            "CREATE TABLE IF NOT EXISTS `preregistration_groups` (" +
            "  `groupToken` VARCHAR(64)  NOT NULL COMMENT 'UUID token shared with a group of visitors'," +
            "  `locationId` VARCHAR(50)  NOT NULL COMMENT 'Location for which the link was generated'," +
            "  `expiresAt`  TIMESTAMP    NOT NULL COMMENT 'Link expiry time (24 hrs from creation)'," +
            "  `createdBy`  VARCHAR(100) NOT NULL COMMENT 'Employee who generated the link'," +
            "  `createdAt`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP," +
            "  PRIMARY KEY (`groupToken`)," +
            "  KEY `fk_preg_location` (`locationId`)," +
            "  CONSTRAINT `fk_preg_location`" +
            "    FOREIGN KEY (`locationId`) REFERENCES `locationmaster` (`LocationId`)" +
            ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4" +
            "  COMMENT='Pre-registration group links generated by front-desk staff'"
        );

        jdbc.execute(
            "CREATE TABLE IF NOT EXISTS `preregistrations` (" +
            "  `token`          VARCHAR(64)  NOT NULL COMMENT 'Unique token per submitted visitor — encoded in QR code'," +
            "  `groupToken`     VARCHAR(64)  NOT NULL COMMENT 'Parent group link token'," +
            "  `entryType`      ENUM('VISITOR','EMPLOYEE') NOT NULL," +
            "  `name`           VARCHAR(150) NOT NULL," +
            "  `mobile`         VARCHAR(20)  DEFAULT NULL," +
            "  `empId`          VARCHAR(100) DEFAULT NULL," +
            "  `email`          VARCHAR(120) DEFAULT NULL," +
            "  `personToMeetId` VARCHAR(100) DEFAULT NULL," +
            "  `personName`     VARCHAR(150) DEFAULT NULL," +
            "  `hostDepartment` VARCHAR(120) DEFAULT NULL," +
            "  `reasonForVisit` TEXT         DEFAULT NULL," +
            "  `locationId`     VARCHAR(50)  NOT NULL," +
            "  `status`         ENUM('PENDING','CHECKED_IN') NOT NULL DEFAULT 'PENDING'," +
            "  `createdAt`      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP," +
            "  `visitorId`      VARCHAR(20)  DEFAULT NULL COMMENT 'Set after QR check-in'," +
            "  PRIMARY KEY (`token`)," +
            "  KEY `idx_prereg_group` (`groupToken`)," +
            "  KEY `idx_prereg_status` (`status`)" +
            ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4" +
            "  COMMENT='Individual pre-registration submissions — one row per visitor'"
        );
        log.info("Pre-registration tables ensured.");
    }

    /**
     * Extends the cardrequests.requestType ENUM to include 'INITIAL' for auto-generated
     * starter batches. Safe to call on every startup — checks before altering.
     */
    private void extendRequestTypeEnum() {
        String schema = jdbc.queryForObject("SELECT DATABASE()", String.class);
        String enumValues = jdbc.queryForObject(
            "SELECT COLUMN_TYPE FROM information_schema.COLUMNS " +
            "WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'cardrequests' AND COLUMN_NAME = 'requestType'",
            String.class, schema);
        if (enumValues != null && !enumValues.contains("INITIAL")) {
            jdbc.execute("ALTER TABLE `cardrequests` MODIFY COLUMN `requestType` " +
                "ENUM('ADDITIONAL','REPLACEMENT','INITIAL') NOT NULL");
            log.info("Migration: extended cardrequests.requestType enum to include INITIAL");
        }
    }

    /**
     * For each location that already has cards but no INITIAL cardrequests entry,
     * creates a FULFILLED INITIAL request and links the existing cards to it.
     * This runs after every startup and is fully idempotent.
     */
    private void seedInitialCardRequests() {
        var locations = jdbc.queryForList(
            "SELECT DISTINCT c.locationId, lm.descriptiveName " +
            "FROM cardmaster c " +
            "JOIN locationmaster lm ON lm.LocationId = c.locationId " +
            "WHERE NOT EXISTS (" +
            "  SELECT 1 FROM cardrequests cr " +
            "  WHERE cr.locationId = c.locationId AND cr.requestType = 'INITIAL'" +
            ")");
        for (var row : locations) {
            String locId = (String) row.get("locationId");
            Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM cardmaster WHERE locationId = ?", Integer.class, locId);
            if (count == null || count == 0) continue;

            jdbc.update(
                "INSERT INTO cardrequests " +
                "(locationId, requestType, quantity, notes, status, requestedBy, requestedAt, fulfilledAt, fulfilledBy) " +
                "VALUES (?, 'INITIAL', ?, 'Auto-generated initial card batch', " +
                "        'FULFILLED', 'SYSTEM', NOW(), NOW(), 'SYSTEM')",
                locId, count);

            Long reqId = jdbc.queryForObject(
                "SELECT id FROM cardrequests WHERE locationId = ? AND requestType = 'INITIAL' " +
                "ORDER BY id DESC LIMIT 1",
                Long.class, locId);
            if (reqId != null) {
                // Link only the first 100 cards by id — the original seed batch.
                // Cards beyond the first 100 were added by subsequent fulfilled requests;
                // the time-window fallback in CardService handles those at download time.
                jdbc.update(
                    "UPDATE cardmaster c " +
                    "JOIN (SELECT id AS cid FROM cardmaster WHERE locationId = ? ORDER BY id LIMIT 100) t " +
                    "  ON c.id = t.cid " +
                    "SET c.requestId = ? " +
                    "WHERE c.requestId IS NULL",
                    locId, reqId);
                log.info("Seeded INITIAL card request {} for location {} — first-100 cards linked",
                         reqId, locId);
            }
        }
    }

    /**
     * Adds a column to a table only if it does not already exist.
     *
     * @param table      table name
     * @param column     column name
     * @param definition column type + constraints (e.g. "VARCHAR(60) DEFAULT NULL")
     * @param position   optional positional clause (e.g. "AFTER `cardNumber`"), or null
     */
    private void addColumnIfMissing(String table, String column, String definition, String position) {
        String schema = jdbc.queryForObject("SELECT DATABASE()", String.class);
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.COLUMNS " +
                "WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?",
                Integer.class, schema, table, column);

        if (count != null && count == 0) {
            String pos = (position != null && !position.isBlank()) ? " " + position : "";
            String sql = String.format("ALTER TABLE `%s` ADD COLUMN `%s` %s%s", table, column, definition, pos);
            jdbc.execute(sql);
            log.info("Migration applied: added column `{}` to `{}`", column, table);
        } else {
            log.debug("Migration skipped: column `{}` already exists in `{}`", column, table);
        }
    }
}
