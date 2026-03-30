-- =============================================================================
--  Medplus Front Desk Application — Database Schema
--  Database : frontdesk
--  Engine   : MySQL 8.0+
--  Charset  : utf8mb4 / utf8mb4_0900_ai_ci
-- =============================================================================
--
--  HOW TO RUN
--  ----------
--  Option A — MySQL command line:
--      mysql -u root -p < schema.sql
--
--  Option B — MySQL Workbench:
--      Open this file → Run (Ctrl+Shift+Enter)
--
--  Option C — From project root (after cloning):
--      mysql -u root -p < frontdesk-backend/src/main/resources/db/schema.sql
--
--  NOTE: Running this script will DROP and re-create the `frontdesk` database.
--        All existing data will be lost.
-- =============================================================================

-- ── 0. Database setup ─────────────────────────────────────────────────────────

DROP DATABASE IF EXISTS `frontdesk`;

CREATE DATABASE `frontdesk`
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci;

USE `frontdesk`;

-- ── 1. locationmaster ─────────────────────────────────────────────────────────
--
--  Stores physical Medplus locations (branches, head office, etc.).
--  Must be created FIRST — referenced by usermanagement.location (FK).
--
--  status values:
--    CONFIGURED    → location is fully set up and active
--    NOTCONFIGURED → location added but setup is pending

CREATE TABLE `locationmaster` (
    `LocationId`      VARCHAR(50)                        NOT NULL  COMMENT 'Unique location code, e.g. HO-HO-HYD',
    `descriptiveName` VARCHAR(150)                       NOT NULL  COMMENT 'Full display name of the location',
    `type`            VARCHAR(150)                       NOT NULL  COMMENT 'Location type, e.g. HEAD_OFFICE, BRANCH',
    `coordinates`     VARCHAR(100)                       DEFAULT NULL COMMENT 'Optional lat,lng coordinates',
    `address`         VARCHAR(255)                       NOT NULL  COMMENT 'Street address',
    `city`            VARCHAR(100)                       NOT NULL,
    `state`           VARCHAR(100)                       NOT NULL,
    `pincode`         VARCHAR(20)                        NOT NULL,
    `status`          VARCHAR(20)                        NOT NULL DEFAULT 'NOTCONFIGURED' COMMENT 'CONFIGURED = active, NOTCONFIGURED = inactive',
    `createdBy`       VARCHAR(100)                       NOT NULL,
    `modifiedBy`      VARCHAR(100)                       DEFAULT NULL,
    `createdAt`       TIMESTAMP                          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `modifiedAt`      TIMESTAMP                          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`LocationId`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Master table of all Medplus locations';


-- ── 2. usermaster ─────────────────────────────────────────────────────────────
--
--  Stores employee profile / HR details synced from the external HR API.
--  Must be created BEFORE usermanagement — referenced by usermanagement.employeeid (FK).

CREATE TABLE `usermaster` (
    `employeeid`   VARCHAR(100) NOT NULL  COMMENT 'Unique employee identifier (login username)',
    `fullName`     VARCHAR(150) NOT NULL  COMMENT 'Display name of the employee',
    `workemail`    VARCHAR(120) NOT NULL  COMMENT 'Official work email address',
    `phone`        VARCHAR(120) NOT NULL  COMMENT 'Contact phone number',
    `designation`  VARCHAR(120) NOT NULL  COMMENT 'Job title / designation',
    `role`         VARCHAR(100) DEFAULT NULL COMMENT 'HR display role (e.g. Front Desk Officer)',
    `worklocation` VARCHAR(120) NOT NULL  COMMENT 'Name of the work location (descriptive)',
    `department`   VARCHAR(120) NOT NULL  COMMENT 'Department name',
    `createdBy`    VARCHAR(100) NOT NULL,
    `modifiedBy`   VARCHAR(100) DEFAULT NULL,
    `createdAt`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `modifiedAt`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`employeeid`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Employee profile / HR master data';


-- ── 3. usermanagement ────────────────────────────────────────────────────────
--
--  Stores login credentials, role, location assignment, and device-lock info.
--
--  Foreign keys:
--    fk_usermgmt_employeeid → usermaster.employeeid
--    fk_usermgmt_location   → locationmaster.LocationId
--
--  role values:
--    PRIMARY_ADMIN   → full administrative access
--    REGIONAL_ADMIN  → supervisor-level access
--    RECEPTIONIST    → front-desk / OTG access
--
--  status values:
--    ACTIVE   → user can log in
--    INACTIVE → login is blocked
--
--  macaddress:
--    NULL on first login → device gets registered automatically on first successful login.
--    Non-NULL → device is locked; login from a different MAC is rejected.
--    To re-register a device, an Admin/Supervisor must update this via the API.

CREATE TABLE `usermanagement` (
    `employeeid` VARCHAR(100)                                       NOT NULL  COMMENT 'References usermaster.employeeid',
    `fullName`   VARCHAR(150)                                       NOT NULL  COMMENT 'Display name of the employee',
    `ipaddress`  VARCHAR(120)                                       NOT NULL  COMMENT 'Last known IP address of the employee',
    `password`   VARCHAR(255)                                       NOT NULL  COMMENT 'BCrypt-encoded password (cost 12)',
    `location`   VARCHAR(50)                                        NOT NULL  COMMENT 'Assigned location — references locationmaster.LocationId',
    `status`     ENUM('ACTIVE','INACTIVE')                         NOT NULL  COMMENT 'Account status',
    `role`       ENUM('PRIMARY_ADMIN','REGIONAL_ADMIN','RECEPTIONIST') NOT NULL COMMENT 'Access role',
    `macaddress` VARCHAR(200)                                       DEFAULT NULL COMMENT 'Registered device MAC address for device-locking',
    `createdBy`  VARCHAR(100)                                       NOT NULL,
    `modifiedBy` VARCHAR(100)                                       DEFAULT NULL,
    `createdAt`  TIMESTAMP                                          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `modifiedAt` TIMESTAMP                                          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`employeeid`),
    KEY `fk_usermgmt_location` (`location`),
    CONSTRAINT `fk_usermgmt_employeeid`
        FOREIGN KEY (`employeeid`) REFERENCES `usermaster` (`employeeid`),
    CONSTRAINT `fk_usermgmt_location`
        FOREIGN KEY (`location`)   REFERENCES `locationmaster` (`LocationId`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci
  COMMENT='User credentials, roles, location assignments and device-lock info';


-- =============================================================================
--  Schema creation complete.
--
--  Next step: start the Spring Boot application — it will automatically seed
--  the following data via DataInitializer.java on first startup:
--
--  locationmaster:
--    HO-HO-HYD | Medplus Head Office Hyderabad | Balnagar, Hyderabad, Telangana 500037
--
--  usermaster + usermanagement (passwords are BCrypt-encoded on first run):
--    employeeid  | fullName              | password   | role
--    ------------|----------------------|------------|---------------
--    Admin       | Admin User           | Admin      | PRIMARY_ADMIN
--    Supervisor  | Supervisor           | supervisor | REGIONAL_ADMIN
--    OTG001      | Receptionist OTG001  | user       | RECEPTIONIST
--
--  Login API:  POST http://localhost:8080/api/auth/login
-- =============================================================================
