-- =============================================================================
-- MVMS database — tables only (runs on every startup, CREATE IF NOT EXISTS).
-- Admin user: app.bootstrap.admin.* in application.properties (not SQL).
-- Full reset: db/schema.sql (DROP DATABASE + recreate).
-- =============================================================================

-- ── legacy tables (remove if present from older installs) ────────────────────
-- Old schema: usermanagement.fk_usermgmt_employeeid → usermaster. Disable FK
-- checks so usermaster can drop; InnoDB removes orphaned FK on referenced table drop.

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `visitormember`;
DROP TABLE IF EXISTS `appointmentslog`;
DROP TABLE IF EXISTS `busy_slots`;
DROP TABLE IF EXISTS `report_schedule`;
DROP TABLE IF EXISTS `zimbra_sessions`;
DROP TABLE IF EXISTS `usermaster`;
DROP TABLE IF EXISTS `locationmaster`;
DROP TABLE IF EXISTS `locations`;

SET FOREIGN_KEY_CHECKS = 1;

-- ── roles ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `roles` (
    `id`          TINYINT UNSIGNED NOT NULL,
    `code`        VARCHAR(50)      NOT NULL,
    `displayName` VARCHAR(100)     NOT NULL,
    `description` VARCHAR(255)     DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_role_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO `roles` (id, code, displayName, description) VALUES
(1, 'ADMIN',        'Admin',        'Full system access — manage all users and locations'),
(2, 'SUPERVISOR',   'Supervisor',   'Location-level manager — manage receptionists at their location'),
(3, 'RECEPTIONIST', 'Receptionist', 'MVMS operator — visitor check-in and check-out'),
(4, 'DEPT_HEAD',    'Department Head', 'Department-level access — see only their department visits, reports, and check-ins');

-- ── usermanagement ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `usermanagement` (
    `employeeid`   VARCHAR(100)              NOT NULL,
    `fullName`     VARCHAR(150)              NOT NULL,
    `workemail`    VARCHAR(120)              NOT NULL DEFAULT '',
    `phone`        VARCHAR(120)              NOT NULL DEFAULT '',
    `designation`  VARCHAR(120)              NOT NULL DEFAULT 'Employee',
    `department`   VARCHAR(120)              NOT NULL DEFAULT 'General',
    `password`     VARCHAR(255)              NOT NULL,
    `location`     VARCHAR(50)               NOT NULL DEFAULT '' COMMENT 'Supervisor site code only',
    `locationName` VARCHAR(150)              NOT NULL DEFAULT '' COMMENT 'Supervisor display name',
    `loginEnabled` TINYINT(1)                NOT NULL DEFAULT 1,
    `status`       ENUM('ACTIVE','INACTIVE') NOT NULL,
    `roleId`       TINYINT UNSIGNED          NOT NULL DEFAULT 3,
    `assignedDeviceId` VARCHAR(40)           DEFAULT NULL,
    `createdBy`    VARCHAR(100)              NOT NULL,
    `modifiedBy`   VARCHAR(100)              DEFAULT NULL,
    `createdAt`    TIMESTAMP                 NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `modifiedAt`   TIMESTAMP                 NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`employeeid`),
    KEY `idx_usermgmt_location` (`location`),
    KEY `idx_usermgmt_role`     (`roleId`),
    KEY `idx_usermgmt_assigned_device` (`assignedDeviceId`),
    CONSTRAINT `fk_usermgmt_role`
        FOREIGN KEY (`roleId`) REFERENCES `roles` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── user role mapping (multi-role per user) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS `user_role_mapping` (
    `employeeId` VARCHAR(100)      NOT NULL,
    `roleId`     TINYINT UNSIGNED  NOT NULL,
    `createdAt`  TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`employeeId`, `roleId`),
    KEY `idx_urm_role` (`roleId`),
    CONSTRAINT `fk_urm_employee`
        FOREIGN KEY (`employeeId`) REFERENCES `usermanagement` (`employeeid`) ON DELETE CASCADE,
    CONSTRAINT `fk_urm_role`
        FOREIGN KEY (`roleId`) REFERENCES `roles` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── user location mapping (multi-location supervisors) ────────────────────────

CREATE TABLE IF NOT EXISTS `user_location_mapping` (
    `employeeId` VARCHAR(100) NOT NULL,
    `locationId` VARCHAR(20)  NOT NULL,
    `createdAt`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`employeeId`, `locationId`),
    KEY `idx_ulm_location` (`locationId`),
    CONSTRAINT `fk_ulm_employee`
        FOREIGN KEY (`employeeId`) REFERENCES `usermanagement` (`employeeid`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── temporary device access grants (cover / absent receptionist) ─────────────

CREATE TABLE IF NOT EXISTS `user_temp_device_grants` (
    `id`         BIGINT       NOT NULL AUTO_INCREMENT,
    `employeeId` VARCHAR(100) NOT NULL,
    `macAddress` VARCHAR(200) NOT NULL,
    `expiresAt`  TIMESTAMP    NOT NULL,
    `grantedBy`  VARCHAR(100) NOT NULL,
    `reason`     VARCHAR(255) NOT NULL,
    `status`     ENUM('ACTIVE','REVOKED','EXPIRED') NOT NULL DEFAULT 'ACTIVE',
    `revokedBy`  VARCHAR(100) DEFAULT NULL,
    `revokedAt`  TIMESTAMP    DEFAULT NULL,
    `createdAt`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_temp_grant_employee_status` (`employeeId`, `status`, `expiresAt`),
    CONSTRAINT `fk_temp_grant_employee`
        FOREIGN KEY (`employeeId`) REFERENCES `usermanagement` (`employeeid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── visitorlog ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `visitorlog` (
    `visitorId`      VARCHAR(32)                        NOT NULL,
    `visitType`      ENUM('INDIVIDUAL','GROUP')         NOT NULL,
    `groupId`        VARCHAR(32)                        DEFAULT NULL COMMENT 'MED-GROUP-#### shared by group members',
    `entryType`      ENUM('VISITOR','EMPLOYEE')         NOT NULL,
    `name`           VARCHAR(150)                       NOT NULL,
    `mobile`         VARCHAR(20)                        DEFAULT NULL,
    `empId`          VARCHAR(100)                       DEFAULT NULL,
    `status`         ENUM('PENDING_APPROVAL','APPROVED','CHECKED_IN','REJECTED','CHECKED_OUT') NOT NULL DEFAULT 'CHECKED_IN',
    `personToMeet`   VARCHAR(100)                       NOT NULL,
    `personName`     VARCHAR(150)                       NOT NULL,
    `personToMeetPhone` VARCHAR(20)                     DEFAULT NULL COMMENT 'Host mobile snapshot for Key Management SMS',
    `department`     VARCHAR(120)                       NOT NULL,
    `locationId`     VARCHAR(50)                        NOT NULL COMMENT 'Site code',
    `cardNumber`     INT                                DEFAULT NULL,
    `govtIdType`     ENUM('AADHAAR','PAN','PASSPORT','VOTER','DL') DEFAULT NULL,
    `govtIdNumber`   VARCHAR(60)                        DEFAULT NULL,
    `imageUrl`       VARCHAR(500)                       DEFAULT NULL,
    `checkInTime`    TIMESTAMP                          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `checkOutTime`   TIMESTAMP                          DEFAULT NULL,
    `approvedAt`     TIMESTAMP                          DEFAULT NULL,
    `rejectedAt`     TIMESTAMP                          DEFAULT NULL,
    `rejectionRemarks` VARCHAR(500)                     DEFAULT NULL,
    `reasonForVisit` TEXT                               DEFAULT NULL,
    `companyName`    VARCHAR(200)                       DEFAULT NULL,
    `createdBy`      VARCHAR(100)                       NOT NULL,
    `workstationMac` VARCHAR(20)                        DEFAULT NULL,
    `modifiedBy`     VARCHAR(100)                       DEFAULT NULL,
    `modifiedAt`     TIMESTAMP                          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`visitorId`),
    KEY `idx_vlog_location_date` (`locationId`, `checkInTime`),
    KEY `idx_vlog_groupId` (`groupId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── pre-registration ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `preregistration_groups` (
    `groupToken` VARCHAR(64)  NOT NULL,
    `locationId` VARCHAR(50)  NOT NULL,
    `expiresAt`  TIMESTAMP    NOT NULL,
    `createdBy`  VARCHAR(100) NOT NULL,
    `createdAt`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`groupToken`),
    KEY `idx_preg_group_location` (`locationId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── location master (structured site codes: IN + state + city + sequence) ───

CREATE TABLE IF NOT EXISTS `company_master` (
    `id`          BIGINT       NOT NULL AUTO_INCREMENT,
    `companyCode` VARCHAR(20)  NOT NULL,
    `companyName` VARCHAR(150) NOT NULL,
    `status`      ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdBy`   VARCHAR(100) NOT NULL,
    `modifiedBy`  VARCHAR(100) DEFAULT NULL,
    `createdAt`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `modifiedAt`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_company_code` (`companyCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `location_type_master` (
    `id`        BIGINT       NOT NULL AUTO_INCREMENT,
    `typeCode`  VARCHAR(20)  NOT NULL,
    `typeName`  VARCHAR(100) NOT NULL,
    `status`    ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdBy` VARCHAR(100) NOT NULL,
    `modifiedBy` VARCHAR(100) DEFAULT NULL,
    `createdAt` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `modifiedAt` TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_location_type_code` (`typeCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `state_master` (
    `id`        BIGINT       NOT NULL AUTO_INCREMENT,
    `stateCode` VARCHAR(2)   NOT NULL COMMENT '2-char code, e.g. TG',
    `stateName` VARCHAR(100) NOT NULL,
    `status`    ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdBy` VARCHAR(100) NOT NULL,
    `modifiedBy` VARCHAR(100) DEFAULT NULL,
    `createdAt` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `modifiedAt` TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_state_code` (`stateCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `city_master` (
    `id`        BIGINT       NOT NULL AUTO_INCREMENT,
    `cityCode`  VARCHAR(3)   NOT NULL COMMENT '3-char code, e.g. HYD',
    `cityName`  VARCHAR(100) NOT NULL,
    `stateCode` VARCHAR(2)   NOT NULL,
    `status`    ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdBy` VARCHAR(100) NOT NULL,
    `modifiedBy` VARCHAR(100) DEFAULT NULL,
    `createdAt` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `modifiedAt` TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_city_state_code` (`stateCode`, `cityCode`),
    CONSTRAINT `fk_city_state`
        FOREIGN KEY (`stateCode`) REFERENCES `state_master` (`stateCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `location_master` (
    `locationId`      VARCHAR(20)  NOT NULL COMMENT 'company(3) + office initials + seq(5), e.g. MED-HO-00001',
    `companyId`       BIGINT       NOT NULL,
    `locationTypeId`  BIGINT       NOT NULL,
    `stateCode`       VARCHAR(2)   NOT NULL,
    `cityCode`        VARCHAR(3)   NOT NULL,
    `address`         VARCHAR(500) NOT NULL,
    `descriptiveName` VARCHAR(200) NOT NULL,
    `sequenceNum`     INT          NOT NULL,
    `status`          ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdBy`       VARCHAR(100) NOT NULL,
    `modifiedBy`    VARCHAR(100) DEFAULT NULL,
    `createdAt`       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `modifiedAt`      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`locationId`),
    KEY `idx_loc_state_city_seq` (`stateCode`, `cityCode`, `sequenceNum`),
    KEY `idx_loc_company` (`companyId`),
    CONSTRAINT `fk_loc_company`
        FOREIGN KEY (`companyId`) REFERENCES `company_master` (`id`),
    CONSTRAINT `fk_loc_type`
        FOREIGN KEY (`locationTypeId`) REFERENCES `location_type_master` (`id`),
    CONSTRAINT `fk_loc_state`
        FOREIGN KEY (`stateCode`) REFERENCES `state_master` (`stateCode`),
    CONSTRAINT `fk_loc_city`
        FOREIGN KEY (`stateCode`, `cityCode`) REFERENCES `city_master` (`stateCode`, `cityCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO `state_master` (`stateCode`, `stateName`, `createdBy`) VALUES
('TG', 'Telangana', 'SYSTEM'),
('AP', 'Andhra Pradesh', 'SYSTEM'),
('KA', 'Karnataka', 'SYSTEM'),
('TN', 'Tamil Nadu', 'SYSTEM'),
('MH', 'Maharashtra', 'SYSTEM'),
('DL', 'Delhi', 'SYSTEM');

INSERT IGNORE INTO `city_master` (`cityCode`, `cityName`, `stateCode`, `createdBy`) VALUES
('HYD', 'Hyderabad', 'TG', 'SYSTEM'),
('VZG', 'Visakhapatnam', 'AP', 'SYSTEM'),
('VJA', 'Vijayawada', 'AP', 'SYSTEM'),
('BLR', 'Bengaluru', 'KA', 'SYSTEM'),
('MAA', 'Chennai', 'TN', 'SYSTEM'),
('BOM', 'Mumbai', 'MH', 'SYSTEM'),
('DEL', 'New Delhi', 'DL', 'SYSTEM');

-- ── pre-registration ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `preregistrations` (
    `token`          VARCHAR(64)  NOT NULL,
    `groupToken`     VARCHAR(64)  DEFAULT NULL,
    `entryType`      ENUM('VISITOR','EMPLOYEE') NOT NULL,
    `name`           VARCHAR(150) NOT NULL,
    `mobile`         VARCHAR(20)  DEFAULT NULL,
    `empId`          VARCHAR(100) DEFAULT NULL,
    `email`          VARCHAR(120) DEFAULT NULL,
    `govtIdType`     VARCHAR(20)  DEFAULT NULL,
    `govtIdNumber`   VARCHAR(60)  DEFAULT NULL,
    `personToMeetId` VARCHAR(100) DEFAULT NULL,
    `personName`     VARCHAR(150) DEFAULT NULL,
    `hostDepartment` VARCHAR(120) DEFAULT NULL,
    `reasonForVisit` TEXT         DEFAULT NULL,
    `companyName`    VARCHAR(200) DEFAULT NULL,
    `locationId`     VARCHAR(50)  DEFAULT NULL,
    `status`         ENUM('PENDING','CHECKED_IN') NOT NULL DEFAULT 'PENDING',
    `createdAt`      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `visitorId`          VARCHAR(32)  DEFAULT NULL,
    `visitCardImageUrl`  VARCHAR(500) DEFAULT NULL,
    `visitCardShortUrl`  VARCHAR(200) DEFAULT NULL,
    `visitCardSentAt`    TIMESTAMP    DEFAULT NULL,
    `visitCardSmsStatus` VARCHAR(20)  DEFAULT NULL,
    `visitCardSmsError`  VARCHAR(255) DEFAULT NULL,
    PRIMARY KEY (`token`),
    KEY `idx_prereg_group` (`groupToken`),
    KEY `idx_prereg_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── device master (kiosks / scan points per location) ───────────────────────

CREATE TABLE IF NOT EXISTS `device_master` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `user_device_grants` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `visitor_scan_events` (
    `id`          BIGINT       NOT NULL AUTO_INCREMENT,
    `visitorId`   VARCHAR(32)  NOT NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── Key Management contacts (approver phone numbers) ────────────────────────

CREATE TABLE IF NOT EXISTS `key_management_contacts` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
