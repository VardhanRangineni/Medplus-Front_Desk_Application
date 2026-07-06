package com.medplus.frontdesk_backend.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Idempotent schema for kiosk device master and visitor movement events.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DeviceAndMovementSchemaMigration implements ApplicationRunner {

    private final JdbcTemplate jdbc;

    @Override
    public void run(ApplicationArguments args) {
        createDeviceMaster();
        createUserDeviceGrants();
        createVisitorScanEvents();
        addVisitorLogDeviceColumns();
    }

    private void createDeviceMaster() {
        if (tableExists("device_master")) {
            return;
        }
        log.info("[DeviceSchema] Creating device_master");
        jdbc.execute("""
                CREATE TABLE `device_master` (
                    `deviceId`      VARCHAR(40)  NOT NULL,
                    `locationId`    VARCHAR(20)  NOT NULL,
                    `displayName`   VARCHAR(150) NOT NULL,
                    `floor`         VARCHAR(20)  DEFAULT NULL,
                    `area`          VARCHAR(100) DEFAULT NULL,
                    `macAddress`    VARCHAR(200) DEFAULT NULL,
                    `ipAddress`     VARCHAR(120) DEFAULT NULL,
                    `lastKnownIp`   VARCHAR(120) DEFAULT NULL,
                    `status`        ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
                    `createdBy`     VARCHAR(100) NOT NULL,
                    `modifiedBy`    VARCHAR(100) DEFAULT NULL,
                    `createdAt`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    `modifiedAt`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    PRIMARY KEY (`deviceId`),
                    KEY `idx_device_location` (`locationId`),
                    KEY `idx_device_status` (`status`),
                    CONSTRAINT `fk_device_location`
                        FOREIGN KEY (`locationId`) REFERENCES `location_master` (`locationId`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
                """);
    }

    private void createUserDeviceGrants() {
        if (tableExists("user_device_grants")) {
            return;
        }
        log.info("[DeviceSchema] Creating user_device_grants");
        jdbc.execute("""
                CREATE TABLE `user_device_grants` (
                    `id`          BIGINT       NOT NULL AUTO_INCREMENT,
                    `employeeId`  VARCHAR(100) NOT NULL,
                    `deviceId`    VARCHAR(40)  NOT NULL,
                    `expiresAt`   TIMESTAMP    NOT NULL,
                    `reason`      VARCHAR(255) NOT NULL,
                    `status`      ENUM('ACTIVE','REVOKED','EXPIRED') NOT NULL DEFAULT 'ACTIVE',
                    `grantedBy`   VARCHAR(100) NOT NULL,
                    `revokedBy`   VARCHAR(100) DEFAULT NULL,
                    `revokedAt`   TIMESTAMP    DEFAULT NULL,
                    `createdAt`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (`id`),
                    KEY `idx_udg_employee_status` (`employeeId`, `status`, `expiresAt`),
                    KEY `idx_udg_device` (`deviceId`),
                    CONSTRAINT `fk_udg_employee`
                        FOREIGN KEY (`employeeId`) REFERENCES `usermanagement` (`employeeid`),
                    CONSTRAINT `fk_udg_device`
                        FOREIGN KEY (`deviceId`) REFERENCES `device_master` (`deviceId`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
                """);
    }

    private void createVisitorScanEvents() {
        if (tableExists("visitor_scan_events")) {
            return;
        }
        log.info("[DeviceSchema] Creating visitor_scan_events");
        jdbc.execute("""
                CREATE TABLE `visitor_scan_events` (
                    `id`          BIGINT       NOT NULL AUTO_INCREMENT,
                    `visitorId`   VARCHAR(20)  NOT NULL,
                    `locationId`  VARCHAR(20)  NOT NULL,
                    `deviceId`    VARCHAR(40)  NOT NULL,
                    `eventType`   ENUM('CHECK_IN','ZONE_SCAN','CHECK_OUT') NOT NULL,
                    `preregToken` VARCHAR(64)  DEFAULT NULL,
                    `scannedBy`   VARCHAR(100) DEFAULT NULL,
                    `deviceMac`   VARCHAR(200) DEFAULT NULL,
                    `scannedAt`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (`id`),
                    KEY `idx_vse_visitor` (`visitorId`, `scannedAt`),
                    KEY `idx_vse_location_time` (`locationId`, `scannedAt`),
                    KEY `idx_vse_device_time` (`deviceId`, `scannedAt`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
                """);
    }

    private void addVisitorLogDeviceColumns() {
        addColumnIfMissing("visitorlog", "checkInDeviceId",
                "VARCHAR(40) DEFAULT NULL AFTER workstationMac");
        addColumnIfMissing("visitorlog", "lastScanDeviceId",
                "VARCHAR(40) DEFAULT NULL AFTER checkInDeviceId");
        addColumnIfMissing("visitorlog", "lastScanAt",
                "TIMESTAMP DEFAULT NULL AFTER lastScanDeviceId");
        addColumnIfMissing("device_master", "ipAddress",
                "VARCHAR(120) DEFAULT NULL AFTER macAddress");
        addColumnIfMissing("usermanagement", "assignedDeviceId",
                "VARCHAR(40) DEFAULT NULL AFTER roleId");
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

    private void addColumnIfMissing(String table, String column, String definition) {
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
        if (count != null && count > 0) {
            return;
        }
        log.info("[DeviceSchema] Adding {}.{}", table, column);
        jdbc.execute("ALTER TABLE `" + table + "` ADD COLUMN `" + column + "` " + definition);
    }
}
