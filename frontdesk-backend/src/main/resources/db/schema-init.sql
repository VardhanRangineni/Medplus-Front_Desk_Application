-- =============================================================================
--  Medplus Front Desk — Auto-Init Schema
--  Run automatically by Spring Boot on every startup.
--  All statements use IF NOT EXISTS — safe to run repeatedly, no data loss.
-- =============================================================================

-- ── 1. locationmaster ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `locationmaster` (
    `LocationId`      VARCHAR(50)  NOT NULL  COMMENT 'Unique location code, e.g. HO-HO-HYD',
    `descriptiveName` VARCHAR(150) NOT NULL  COMMENT 'Full display name of the location',
    `type`            VARCHAR(150) NOT NULL  COMMENT 'Location type, e.g. HEAD_OFFICE, BRANCH',
    `coordinates`     VARCHAR(100) DEFAULT NULL COMMENT 'Optional lat,lng coordinates',
    `address`         VARCHAR(255) NOT NULL  COMMENT 'Street address',
    `city`            VARCHAR(100) NOT NULL,
    `state`           VARCHAR(100) NOT NULL,
    `pincode`         VARCHAR(20)  NOT NULL,
    `status`          VARCHAR(20)  NOT NULL DEFAULT 'NOTCONFIGURED' COMMENT 'CONFIGURED = active, NOTCONFIGURED = inactive',
    `createdBy`       VARCHAR(100) NOT NULL,
    `modifiedBy`      VARCHAR(100) DEFAULT NULL,
    `createdAt`       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `modifiedAt`      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`LocationId`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Master table of all Medplus locations';


-- ── 2. usermaster ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `usermaster` (
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

CREATE TABLE IF NOT EXISTS `usermanagement` (
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


-- ── 4. visitorlog ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `visitorlog` (
    `visitorId`      VARCHAR(20)                        NOT NULL  COMMENT 'Auto-generated: MED-V-0001 (Individual) or MED-GV-0001 (Group)',
    `visitType`      ENUM('INDIVIDUAL','GROUP')          NOT NULL  COMMENT 'Individual or Group visit',
    `entryType`      ENUM('VISITOR','EMPLOYEE')          NOT NULL  COMMENT 'External visitor or internal employee',
    `name`           VARCHAR(150)                       NOT NULL  COMMENT 'Primary visitor / employee name',
    `mobile`         VARCHAR(20)                        DEFAULT NULL COMMENT 'Mobile number (VISITOR only)',
    `empId`          VARCHAR(100)                       DEFAULT NULL COMMENT 'Employee ID (EMPLOYEE only)',
    `status`         ENUM('CHECKED_IN','CHECKED_OUT')   NOT NULL  DEFAULT 'CHECKED_IN',
    `personToMeet`   VARCHAR(100)                       NOT NULL  COMMENT 'employeeid of the person being visited',
    `personName`     VARCHAR(150)                       NOT NULL  COMMENT 'Full name of person to meet (denormalised)',
    `department`     VARCHAR(120)                       NOT NULL  COMMENT 'Department of personToMeet at time of visit',
    `locationId`     VARCHAR(50)                        NOT NULL  COMMENT 'Location where check-in occurred',
    `cardNumber`     INT                                DEFAULT NULL COMMENT 'Visitor card / badge number (manual entry)',
    `cardCode`       VARCHAR(50)                        DEFAULT NULL COMMENT 'Auto-assigned card code from cardmaster, e.g. MSOH-VISITOR-1',
    `govtIdType`     ENUM('AADHAAR','PAN','PASSPORT','VOTER','DL') DEFAULT NULL COMMENT 'Government-issued ID type',
    `govtIdNumber`   VARCHAR(60)                        DEFAULT NULL COMMENT 'Government ID number (masked or full)',
    `imageUrl`       VARCHAR(500)                       DEFAULT NULL COMMENT 'Visitor photo URL — local path now, swap to cloud storage URL when ready',
    `checkInTime`    TIMESTAMP                          NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    `checkOutTime`   TIMESTAMP                          DEFAULT NULL,
    `reasonForVisit` TEXT                               DEFAULT NULL,
    `createdBy`      VARCHAR(100)                       NOT NULL,
    `modifiedBy`     VARCHAR(100)                       DEFAULT NULL,
    `modifiedAt`     TIMESTAMP                          NOT NULL  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`visitorId`),
    KEY `idx_vlog_location_date` (`locationId`, `checkInTime`),
    CONSTRAINT `fk_vlog_location`
        FOREIGN KEY (`locationId`) REFERENCES `locationmaster` (`LocationId`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Visitor / employee check-in and check-out log';



-- ── 5. appointmentslog ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `appointmentslog` (
    `appointmentId`   VARCHAR(30)                NOT NULL  COMMENT 'Human-readable reference, e.g. APT-20260416-0001',
    `bookingToken`    VARCHAR(36)                DEFAULT NULL COMMENT 'UUID used by the web app for polling confirmation',
    `entryType`       ENUM('VISITOR','EMPLOYEE') NOT NULL  DEFAULT 'VISITOR',
    `name`            VARCHAR(150)               NOT NULL  COMMENT 'Patient / visitor full name',
    `aadhaarNumber`   VARCHAR(12)                DEFAULT NULL,
    `email`           VARCHAR(120)               DEFAULT NULL,
    `mobile`          VARCHAR(20)                DEFAULT NULL,
    `empId`           VARCHAR(100)               DEFAULT NULL COMMENT 'Employee ID (EMPLOYEE flow only)',
    `personToMeet`    VARCHAR(100)               NOT NULL  COMMENT 'employeeid of doctor / host',
    `personName`      VARCHAR(150)               DEFAULT NULL COMMENT 'Full name of doctor / host (denormalised)',
    `department`      VARCHAR(120)               DEFAULT NULL,
    `locationId`      VARCHAR(50)                DEFAULT NULL,
    `locationName`    VARCHAR(150)               DEFAULT NULL,
    `appointmentDate` DATE                       NOT NULL,
    `appointmentTime` TIME                       NOT NULL  COMMENT '24-hour format, e.g. 16:00:00',
    `reasonForVisit`  TEXT                       DEFAULT NULL,
    `status`          VARCHAR(20)                NOT NULL DEFAULT 'PENDING'
                      COMMENT 'PENDING | DECLINED | RESCHEDULED | CHECKED_IN | CANCELLED',
    `zimbraInviteId`  VARCHAR(128)               DEFAULT NULL
                      COMMENT 'Zimbra invId — used for reschedule/decline',
    `declineReason`   VARCHAR(500)               DEFAULT NULL,
    `createdAt`       TIMESTAMP                  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`appointmentId`),
    KEY `idx_appt_date_time`    (`appointmentDate`, `appointmentTime`),
    KEY `idx_appt_location`     (`locationId`),
    KEY `idx_appt_booking_token`(`bookingToken`),
    KEY `idx_appt_status`       (`status`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Scheduled appointments from the public booking web app';


-- ── 5b. busy_slots ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `busy_slots` (
    `id`             VARCHAR(36)  NOT NULL,
    `employeeId`     VARCHAR(100) NOT NULL COMMENT 'FK → usermaster.employeeid',
    `startTime`      DATETIME     NOT NULL,
    `endTime`        DATETIME     NOT NULL,
    `reason`         VARCHAR(255) DEFAULT NULL,
    `zimbraEventId`  VARCHAR(128) DEFAULT NULL COMMENT 'Zimbra invId if synced to calendar',
    `createdBy`      VARCHAR(100) DEFAULT NULL,
    `createdAt`      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_busy_employee_range` (`employeeId`, `startTime`, `endTime`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COMMENT='Manual busy-time blocks owned by employees';


-- ── 6. visitormember ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `visitormember` (
    `memberId`     VARCHAR(20)                        NOT NULL  COMMENT 'Auto-generated: MED-GM-0001',
    `visitorId`    VARCHAR(20)                        NOT NULL  COMMENT 'Parent visitorlog entry (group visit)',
    `name`         VARCHAR(150)                       NOT NULL  COMMENT 'Member name',
    `cardNumber`   INT                                DEFAULT NULL,
    `cardCode`     VARCHAR(50)                        DEFAULT NULL COMMENT 'Auto-assigned card code from cardmaster',
    `status`       ENUM('CHECKED_IN','CHECKED_OUT')   NOT NULL  DEFAULT 'CHECKED_IN',
    `checkOutTime` TIMESTAMP                          DEFAULT NULL,
    `createdAt`    TIMESTAMP                          NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`memberId`),
    KEY `fk_vmember_visitor` (`visitorId`),
    CONSTRAINT `fk_vmember_visitor`
        FOREIGN KEY (`visitorId`) REFERENCES `visitorlog` (`visitorId`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Additional members of a group visitor entry';
