-- =============================================================================
--  Medplus Front Desk — Auto-Init Schema
--  Run automatically by Spring Boot on every startup.
--  All statements use IF NOT EXISTS — safe to run repeatedly, no data loss.
-- =============================================================================

CREATE TABLE IF NOT EXISTS `locationmaster` (
    `LocationId`      VARCHAR(50)                        NOT NULL  COMMENT 'Unique location code, e.g. HO-HO-HYD',
    `descriptiveName` VARCHAR(150)                       NOT NULL  COMMENT 'Full display name of the location',
    `type`            VARCHAR(150)                       NOT NULL  COMMENT 'Location type, e.g. HEAD_OFFICE, BRANCH',
    `coordinates`     VARCHAR(100)                       DEFAULT NULL COMMENT 'Optional lat,lng coordinates',
    `address`         VARCHAR(255)                       NOT NULL  COMMENT 'Street address',
    `city`            VARCHAR(100)                       NOT NULL,
    `state`           VARCHAR(100)                       NOT NULL,
    `pincode`         VARCHAR(20)                        NOT NULL,
    `status`          ENUM('CONFIGURED','NOTCONFIGURED') NOT NULL,
    `createdBy`       VARCHAR(100)                       NOT NULL,
    `modifiedBy`      VARCHAR(100)                       DEFAULT NULL,
    `createdAt`       TIMESTAMP                          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `modifiedAt`      TIMESTAMP                          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`LocationId`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Master table of all Medplus locations';


CREATE TABLE IF NOT EXISTS `usermaster` (
    `employeeid`   VARCHAR(100) NOT NULL  COMMENT 'Unique employee identifier (login username)',
    `fullName`     VARCHAR(150) NOT NULL  COMMENT 'Display name of the employee',
    `workemail`    VARCHAR(120) NOT NULL  COMMENT 'Official work email address',
    `phone`        VARCHAR(120) NOT NULL  COMMENT 'Contact phone number',
    `designation`  VARCHAR(120) NOT NULL  COMMENT 'Job title / designation',
    `worklocation` VARCHAR(120) NOT NULL  COMMENT 'Name of the work location (descriptive)',
    `department`   VARCHAR(120) NOT NULL  COMMENT 'Department name',
    PRIMARY KEY (`employeeid`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Employee profile / HR master data';


CREATE TABLE IF NOT EXISTS `usermanagement` (
    `employeeid` VARCHAR(100)                                       NOT NULL  COMMENT 'References usermaster.employeeid',
    `ipaddress`  VARCHAR(120)                                       NOT NULL  COMMENT 'Last known IP address of the employee',
    `password`   VARCHAR(255)                                       NOT NULL  COMMENT 'BCrypt-encoded password (cost 12)',
    `location`   VARCHAR(50)                                        NOT NULL  COMMENT 'Assigned location — references locationmaster.LocationId',
    `status`     ENUM('ACTIVE','INACTIVE')                         NOT NULL  COMMENT 'Account status',
    `role`       ENUM('PRIMARY_ADMIN','REGIONAL_ADMIN','RECEPTIONIST') NOT NULL COMMENT 'Access role',
    `macaddress` VARCHAR(200)                                       DEFAULT NULL COMMENT 'Registered device MAC address for device-locking',
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
