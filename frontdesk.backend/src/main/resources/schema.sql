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
    `Location` VARCHAR(50) NOT NULL,
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

