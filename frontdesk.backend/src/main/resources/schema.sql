CREATE TABLE IF NOT EXISTS `Locations` (
    `LocationId` VARCHAR(50) NOT NULL,
    `descriptiveName` VARCHAR(150) NOT NULL,
    `type` varchar(150) NOT NULL,
    `coordinates` VARCHAR(100) NULL,
    `address` VARCHAR(255) NOT NULL,
    `city` VARCHAR(100) NOT NULL,
    `state` VARCHAR(100) NOT NULL,
    `pincode` VARCHAR(20) NOT NULL,
    `status` ENUM('CONFIGURED', 'NOTCONFIGURED') NOT NULL,
    `createdBy` VARCHAR(100) NOT NULL,
    `modifiedBy` VARCHAR(100) NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `modifiedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`LocationId`)
);

CREATE TABLE IF NOT EXISTS `User` (
    `username` VARCHAR(100) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `location` VARCHAR(50) NOT NULL,
    `role` ENUM('ADMIN', 'USER') NOT NULL,
    PRIMARY KEY (`username`),
    CONSTRAINT `fk_user_location`
        FOREIGN KEY (`Location`) REFERENCES `Locations`(`LocationId`)
);

CREATE TABLE IF NOT EXISTS `Visitor` (
    `visitorId` VARCHAR(50) NOT NULL,
    `visitorType` ENUM('NONEMPLOYEE','EMPLOYEE') NOT NULL,
    `fullName` VARCHAR(150) NOT NULL,
    `locationId` VARCHAR(50) NOT NULL,
    `identificationNumber` VARCHAR(100) NOT NULL,
    `govtId` VARCHAR(120) NULL,
    `groupHeadVisitorId` VARCHAR(50) NULL,
    `status` ENUM('CheckedIn', 'CheckedOut') NOT NULL,
    `personToMeet` VARCHAR(150) NOT NULL,
    `cardNumber` VARCHAR(50) NOT NULL,
    `checkInTime` TIMESTAMP NOT NULL,
    `checkOutTime` TIMESTAMP NULL,
    `createdBy` VARCHAR(100) NOT NULL,
    `modifiedBy` VARCHAR(100) NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `modifiedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`visitorId`),
    CONSTRAINT `fk_visitor_location`
        FOREIGN KEY (`locationId`) REFERENCES `Locations`(`LocationId`)
);

-- ── Column migration: add govtId if it doesn't exist yet ─────────────────────
-- Uses information_schema + PREPARE so it is safe on MySQL (no IF NOT EXISTS).
SET @add_govtId = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE `Visitor` ADD COLUMN `govtId` VARCHAR(120) NULL AFTER `identificationNumber`',
        'SELECT 1'
    )
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'Visitor'
      AND COLUMN_NAME  = 'govtId'
);
PREPARE stmt_add_govtId FROM @add_govtId;
EXECUTE stmt_add_govtId;
DEALLOCATE PREPARE stmt_add_govtId;

-- ── Column migration: allow NULL for personToMeet ─────────────────────────────
SET @alter_personToMeet = (
    SELECT IF(
        IS_NULLABLE = 'NO',
        'ALTER TABLE `Visitor` MODIFY COLUMN `personToMeet` VARCHAR(150) NULL',
        'SELECT 1'
    )
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'Visitor'
      AND COLUMN_NAME  = 'personToMeet'
);
PREPARE stmt_alter_ptm FROM @alter_personToMeet;
EXECUTE stmt_alter_ptm;
DEALLOCATE PREPARE stmt_alter_ptm;

-- ── Column migration: allow NULL for cardNumber ───────────────────────────────
SET @alter_cardNumber = (
    SELECT IF(
        IS_NULLABLE = 'NO',
        'ALTER TABLE `Visitor` MODIFY COLUMN `cardNumber` VARCHAR(50) NULL',
        'SELECT 1'
    )
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'Visitor'
      AND COLUMN_NAME  = 'cardNumber'
);
PREPARE stmt_alter_cn FROM @alter_cardNumber;
EXECUTE stmt_alter_cn;
DEALLOCATE PREPARE stmt_alter_cn;

