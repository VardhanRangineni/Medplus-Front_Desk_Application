package com.medplus.frontdesk_backend.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Idempotent schema for Key Management contacts (portal tokens) and
 * person-to-meet phone snapshot on visitorlog for host SMS / portal listing.
 */
@Slf4j
@Component
@Order(120)
@RequiredArgsConstructor
public class KeyManagementSchemaMigration implements ApplicationRunner {

    private final JdbcTemplate jdbc;

    @Override
    public void run(ApplicationArguments args) {
        createKeyManagementContacts();
        dropLocationColumnIfPresent();
        ensurePortalTokenColumn();
        backfillMissingPortalTokens();
        addPersonToMeetPhoneColumn();
        expandVisitorStatusEnum();
        addApprovalAuditColumns();
    }

    private void createKeyManagementContacts() {
        if (tableExists("key_management_contacts")) {
            return;
        }
        log.info("[KeyManagementSchema] Creating key_management_contacts");
        jdbc.execute("""
                CREATE TABLE `key_management_contacts` (
                    `id`           BIGINT       NOT NULL AUTO_INCREMENT,
                    `mobile`       VARCHAR(10)  NOT NULL,
                    `displayName`  VARCHAR(150) DEFAULT NULL,
                    `portal_token` CHAR(36)     NOT NULL,
                    `status`       ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
                    `createdBy`    VARCHAR(100) NOT NULL,
                    `modifiedBy`   VARCHAR(100) DEFAULT NULL,
                    `createdAt`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    `modifiedAt`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    PRIMARY KEY (`id`),
                    UNIQUE KEY `uk_km_mobile` (`mobile`),
                    UNIQUE KEY `uk_km_portal_token` (`portal_token`),
                    KEY `idx_km_status` (`status`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
                """);
    }

    private void dropLocationColumnIfPresent() {
        if (!tableExists("key_management_contacts") || !columnExists("key_management_contacts", "locationId")) {
            return;
        }
        log.info("[KeyManagementSchema] Removing locationId from key_management_contacts");
        try {
            jdbc.execute("ALTER TABLE `key_management_contacts` DROP FOREIGN KEY `fk_km_location`");
        } catch (Exception ignored) { /* already gone */ }
        try {
            jdbc.execute("ALTER TABLE `key_management_contacts` DROP INDEX `uk_km_location_mobile`");
        } catch (Exception ignored) { /* already gone */ }
        try {
            jdbc.execute("ALTER TABLE `key_management_contacts` DROP INDEX `idx_km_location_status`");
        } catch (Exception ignored) { /* already gone */ }
        jdbc.execute("ALTER TABLE `key_management_contacts` DROP COLUMN `locationId`");
        if (!indexExists("key_management_contacts", "uk_km_mobile")) {
            jdbc.execute("""
                    DELETE k1 FROM key_management_contacts k1
                    INNER JOIN key_management_contacts k2
                      ON k1.mobile = k2.mobile AND k1.id > k2.id
                    """);
            jdbc.execute("ALTER TABLE `key_management_contacts` ADD UNIQUE KEY `uk_km_mobile` (`mobile`)");
        }
        if (!indexExists("key_management_contacts", "idx_km_status")) {
            jdbc.execute("ALTER TABLE `key_management_contacts` ADD KEY `idx_km_status` (`status`)");
        }
    }

    private void ensurePortalTokenColumn() {
        if (!tableExists("key_management_contacts")) {
            return;
        }
        if (!columnExists("key_management_contacts", "portal_token")) {
            log.info("[KeyManagementSchema] Adding portal_token column");
            jdbc.execute("ALTER TABLE `key_management_contacts` ADD COLUMN `portal_token` CHAR(36) DEFAULT NULL");
        }
        if (!indexExists("key_management_contacts", "uk_km_portal_token")) {
            try {
                jdbc.execute("ALTER TABLE `key_management_contacts` ADD UNIQUE KEY `uk_km_portal_token` (`portal_token`)");
            } catch (Exception ex) {
                log.debug("[KeyManagementSchema] portal_token unique index deferred: {}", ex.getMessage());
            }
        }
    }

    private void backfillMissingPortalTokens() {
        if (!tableExists("key_management_contacts") || !columnExists("key_management_contacts", "portal_token")) {
            return;
        }
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id FROM key_management_contacts WHERE portal_token IS NULL OR portal_token = ''");
        for (Map<String, Object> row : rows) {
            Long id = ((Number) row.get("id")).longValue();
            jdbc.update("UPDATE key_management_contacts SET portal_token = ? WHERE id = ?",
                    UUID.randomUUID().toString(), id);
        }
        if (!rows.isEmpty()) {
            log.info("[KeyManagementSchema] Backfilled portal_token for {} contacts", rows.size());
        }
        try {
            jdbc.execute("ALTER TABLE `key_management_contacts` MODIFY COLUMN `portal_token` CHAR(36) NOT NULL");
        } catch (Exception ex) {
            log.debug("[KeyManagementSchema] portal_token NOT NULL skipped: {}", ex.getMessage());
        }
    }

    private void addPersonToMeetPhoneColumn() {
        if (!tableExists("visitorlog") || columnExists("visitorlog", "personToMeetPhone")) {
            return;
        }
        log.info("[KeyManagementSchema] Adding visitorlog.personToMeetPhone");
        jdbc.execute("ALTER TABLE `visitorlog` ADD COLUMN `personToMeetPhone` VARCHAR(20) DEFAULT NULL");
        jdbc.execute("ALTER TABLE `visitorlog` ADD KEY `idx_vlog_ptm_phone` (`personToMeetPhone`, `status`, `checkInTime`)");
    }

    private void expandVisitorStatusEnum() {
        if (!tableExists("visitorlog")) {
            return;
        }
        try {
            jdbc.execute("""
                    ALTER TABLE `visitorlog`
                    MODIFY COLUMN `status`
                    ENUM('PENDING_APPROVAL','APPROVED','CHECKED_IN','REJECTED','CHECKED_OUT')
                    NOT NULL DEFAULT 'CHECKED_IN'
                    """);
            log.info("[KeyManagementSchema] Expanded visitorlog.status enum");
        } catch (Exception ex) {
            log.debug("[KeyManagementSchema] status enum expand skipped: {}", ex.getMessage());
        }
    }

    private void addApprovalAuditColumns() {
        if (!tableExists("visitorlog")) {
            return;
        }
        addColumnIfMissing("visitorlog", "approvedAt", "TIMESTAMP NULL DEFAULT NULL");
        addColumnIfMissing("visitorlog", "rejectedAt", "TIMESTAMP NULL DEFAULT NULL");
        addColumnIfMissing("visitorlog", "rejectionRemarks", "VARCHAR(500) DEFAULT NULL");
    }

    private void addColumnIfMissing(String table, String column, String definition) {
        if (columnExists(table, column)) {
            return;
        }
        log.info("[KeyManagementSchema] Adding {}.{}", table, column);
        jdbc.execute("ALTER TABLE `" + table + "` ADD COLUMN `" + column + "` " + definition);
    }

    private boolean tableExists(String table) {
        Integer count = jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM information_schema.tables
                WHERE table_schema = DATABASE() AND table_name = ?
                """,
                Integer.class,
                table);
        return count != null && count > 0;
    }

    private boolean columnExists(String table, String column) {
        Integer count = jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
                """,
                Integer.class,
                table,
                column);
        return count != null && count > 0;
    }

    private boolean indexExists(String table, String indexName) {
        Integer count = jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM information_schema.statistics
                WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?
                """,
                Integer.class,
                table,
                indexName);
        return count != null && count > 0;
    }
}
