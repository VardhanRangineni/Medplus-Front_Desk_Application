package com.medplus.frontdesk_backend.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Upgrades databases created before the current MVMS schema (legacy usermaster,
 * locationmaster, ENUM role column, etc.). Idempotent — safe on every startup.
 */
@Slf4j
@Component
@Order(0)
@RequiredArgsConstructor
public class LegacySchemaMigration implements ApplicationRunner {

    private final JdbcTemplate jdbc;

    @Override
    public void run(ApplicationArguments args) {
        upgradeUserManagement();
        upgradeVisitorLog();
    }

    private void upgradeUserManagement() {
        if (!tableExists("usermanagement")) {
            return;
        }

        dropForeignKeyIfExists("usermanagement", "fk_usermgmt_employeeid");
        dropForeignKeyIfExists("usermanagement", "fk_usermgmt_location");

        addColumnIfMissing("usermanagement", "workemail",
                "VARCHAR(120) NOT NULL DEFAULT ''");
        addColumnIfMissing("usermanagement", "phone",
                "VARCHAR(120) NOT NULL DEFAULT ''");
        addColumnIfMissing("usermanagement", "designation",
                "VARCHAR(120) NOT NULL DEFAULT 'Employee'");
        addColumnIfMissing("usermanagement", "department",
                "VARCHAR(120) NOT NULL DEFAULT 'General'");
        addColumnIfMissing("usermanagement", "locationName",
                "VARCHAR(150) NOT NULL DEFAULT ''");
        addColumnIfMissing("usermanagement", "loginEnabled",
                "TINYINT(1) NOT NULL DEFAULT 1");
        addColumnIfMissing("usermanagement", "roleId",
                "TINYINT UNSIGNED NOT NULL DEFAULT 3");

        if (columnExists("usermanagement", "role")) {
            log.info("[LegacySchema] Migrating usermanagement.role ENUM → roleId");
            jdbc.update("""
                    UPDATE usermanagement SET roleId = 1 WHERE role = 'PRIMARY_ADMIN'
                    """);
            jdbc.update("""
                    UPDATE usermanagement SET roleId = 2 WHERE role = 'REGIONAL_ADMIN'
                    """);
            jdbc.update("""
                    UPDATE usermanagement SET roleId = 3 WHERE role = 'RECEPTIONIST'
                    """);
            jdbc.execute("ALTER TABLE `usermanagement` DROP COLUMN `role`");
        }
    }

    private void upgradeVisitorLog() {
        if (!tableExists("visitorlog")) {
            return;
        }

        // Old schema FK → locationmaster; blocks remap to location_master codes.
        dropForeignKeyIfExists("visitorlog", "fk_vlog_location");

        addColumnIfMissing("visitorlog", "visitType",
                "ENUM('INDIVIDUAL','GROUP') NOT NULL DEFAULT 'INDIVIDUAL'");
        addColumnIfMissing("visitorlog", "entryType",
                "ENUM('VISITOR','EMPLOYEE') NOT NULL DEFAULT 'VISITOR'");
        addColumnIfMissing("visitorlog", "personToMeet",
                "VARCHAR(100) NOT NULL DEFAULT ''");
        addColumnIfMissing("visitorlog", "personName",
                "VARCHAR(150) NOT NULL DEFAULT ''");
        addColumnIfMissing("visitorlog", "department",
                "VARCHAR(120) NOT NULL DEFAULT ''");
        addColumnIfMissing("visitorlog", "locationId",
                "VARCHAR(50) NOT NULL DEFAULT ''");
        addColumnIfMissing("visitorlog", "govtIdType",
                "ENUM('AADHAAR','PAN','PASSPORT','VOTER','DL') DEFAULT NULL");
        addColumnIfMissing("visitorlog", "govtIdNumber",
                "VARCHAR(60) DEFAULT NULL");
        addColumnIfMissing("visitorlog", "imageUrl",
                "VARCHAR(500) DEFAULT NULL");
        addColumnIfMissing("visitorlog", "reasonForVisit",
                "TEXT DEFAULT NULL");
        addColumnIfMissing("visitorlog", "companyName",
                "VARCHAR(200) DEFAULT NULL");
        addColumnIfMissing("visitorlog", "workstationMac",
                "VARCHAR(20) DEFAULT NULL");
        addColumnIfMissing("visitorlog", "modifiedBy",
                "VARCHAR(100) DEFAULT NULL");
        addColumnIfMissing("visitorlog", "modifiedAt",
                "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
        addColumnIfMissing("visitorlog", "groupId",
                "VARCHAR(32) DEFAULT NULL COMMENT 'MED-GROUP-#### shared by group members'");
        addIndexIfMissing("visitorlog", "idx_vlog_groupId", "(`groupId`)");
        widenVisitorIdColumns();
    }

    /** Keep room for MED-V-/MED-GV-/MED-GROUP- IDs past 4-digit padding (1L / 10L / 1Cr). */
    private void widenVisitorIdColumns() {
        try {
            jdbc.execute("ALTER TABLE `visitorlog` MODIFY COLUMN `visitorId` VARCHAR(32) NOT NULL");
            jdbc.execute("ALTER TABLE `visitorlog` MODIFY COLUMN `groupId` VARCHAR(32) DEFAULT NULL");
            log.info("[LegacySchema] Widened visitorlog.visitorId/groupId to VARCHAR(32)");
        } catch (Exception ex) {
            log.debug("[LegacySchema] visitorId widen skipped: {}", ex.getMessage());
        }
        if (tableExists("visitor_scan_events")) {
            try {
                jdbc.execute("ALTER TABLE `visitor_scan_events` MODIFY COLUMN `visitorId` VARCHAR(32) NOT NULL");
            } catch (Exception ex) {
                log.debug("[LegacySchema] visitor_scan_events.visitorId widen skipped: {}", ex.getMessage());
            }
        }
        if (tableExists("preregistrations")) {
            try {
                jdbc.execute("ALTER TABLE `preregistrations` MODIFY COLUMN `visitorId` VARCHAR(32) DEFAULT NULL");
            } catch (Exception ex) {
                log.debug("[LegacySchema] preregistrations.visitorId widen skipped: {}", ex.getMessage());
            }
        }
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
                WHERE table_schema = DATABASE()
                  AND table_name = ?
                  AND column_name = ?
                """,
                Integer.class,
                table,
                column);
        return count != null && count > 0;
    }

    private void dropForeignKeyIfExists(String table, String constraintName) {
        Integer count = jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
                WHERE CONSTRAINT_SCHEMA = DATABASE()
                  AND TABLE_NAME = ?
                  AND CONSTRAINT_NAME = ?
                  AND CONSTRAINT_TYPE = 'FOREIGN KEY'
                """,
                Integer.class,
                table,
                constraintName);
        if (count == null || count == 0) {
            return;
        }
        log.info("[LegacySchema] Dropping {}.{}", table, constraintName);
        jdbc.execute("ALTER TABLE `" + table + "` DROP FOREIGN KEY `" + constraintName + "`");
    }

    private void addColumnIfMissing(String table, String column, String definition) {
        if (columnExists(table, column)) {
            return;
        }
        log.info("[LegacySchema] Adding {}.{}", table, column);
        jdbc.execute("ALTER TABLE `" + table + "` ADD COLUMN `" + column + "` " + definition);
    }

    private void addIndexIfMissing(String table, String indexName, String columns) {
        Integer count = jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM information_schema.statistics
                WHERE table_schema = DATABASE()
                  AND table_name = ?
                  AND index_name = ?
                """,
                Integer.class,
                table,
                indexName);
        if (count != null && count > 0) {
            return;
        }
        log.info("[LegacySchema] Adding index {}.{}", table, indexName);
        jdbc.execute("ALTER TABLE `" + table + "` ADD INDEX `" + indexName + "` " + columns);
    }
}
