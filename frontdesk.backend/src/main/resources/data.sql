INSERT INTO `Locations` (
    `LocationId`,
    `descriptiveName`,
    `type`,
    `coordinates`,
    `address`,
    `city`,
    `state`,
    `pincode`,
    `status`,
    `createdBy`,
    `modifiedBy`,
    `createdAt`,
    `modifiedAt`
)
SELECT 'LOC001', 'Main Reception', 'RECEPTION', '17.3850,78.4867',
       'Front Desk, Medplus Campus', 'Hyderabad', 'Telangana', '500001',
       'CONFIGURED', 'admin', 'admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM `Locations` WHERE `LocationId` = 'LOC001');

INSERT INTO `Locations` (
    `LocationId`,
    `descriptiveName`,
    `type`,
    `coordinates`,
    `address`,
    `city`,
    `state`,
    `pincode`,
    `status`,
    `createdBy`,
    `modifiedBy`,
    `createdAt`,
    `modifiedAt`
)
SELECT 'LOC002', 'Admin Cabin', 'CABIN', '17.3855,78.4870',
       'Block A, First Floor', 'Hyderabad', 'Telangana', '500001',
       'CONFIGURED', 'admin', 'admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM `Locations` WHERE `LocationId` = 'LOC002');

INSERT INTO `User` (`username`, `password`, `Location`, `role`)
SELECT 'admin',
       '$2a$10$A.Tw6CL6bUVo1F3Jiwcsdu4s6eYVzIJPZvZpk/M9cCSNz3LrqYgcq',
       'LOC001',
       'ADMIN'
WHERE NOT EXISTS (
    SELECT 1 FROM `User` WHERE `username` = 'admin'
);

INSERT INTO `Visitor` (
    `visitorId`,
    `visitorType`,
    `fullName`,
    `locationId`,
    `identificationNumber`,
    `govtId`,
    `groupHeadVisitorId`,
    `status`,
    `personToMeet`,
    `cardNumber`,
    `checkInTime`,
    `checkOutTime`,
    `createdBy`,
    `modifiedBy`,
    `createdAt`,
    `modifiedAt`
)
SELECT 'VIS001', 'NONEMPLOYEE', 'Ravi Kumar', 'LOC001', 'AADHAAR-1001', 'DL-9001', NULL, 'CheckedIn',
       'Priya Sharma', 'CARD-001', CURRENT_TIMESTAMP - INTERVAL 2 HOUR, NULL,
       'admin', 'admin', CURRENT_TIMESTAMP - INTERVAL 2 HOUR, CURRENT_TIMESTAMP - INTERVAL 30 MINUTE
WHERE NOT EXISTS (SELECT 1 FROM `Visitor` WHERE `visitorId` = 'VIS001');

INSERT INTO `Visitor` (
    `visitorId`,
    `visitorType`,
    `fullName`,
    `locationId`,
    `identificationNumber`,
    `govtId`,
    `groupHeadVisitorId`,
    `status`,
    `personToMeet`,
    `cardNumber`,
    `checkInTime`,
    `checkOutTime`,
    `createdBy`,
    `modifiedBy`,
    `createdAt`,
    `modifiedAt`
)
SELECT 'VIS002', 'NONEMPLOYEE', 'Anita Supplies', 'LOC001', 'GST-2044', 'VENDOR-LIC-2044', NULL, 'CheckedOut',
       'Operations Desk', 'CARD-002', CURRENT_TIMESTAMP - INTERVAL 5 HOUR, CURRENT_TIMESTAMP - INTERVAL 3 HOUR,
       'admin', 'admin', CURRENT_TIMESTAMP - INTERVAL 5 HOUR, CURRENT_TIMESTAMP - INTERVAL 3 HOUR
WHERE NOT EXISTS (SELECT 1 FROM `Visitor` WHERE `visitorId` = 'VIS002');

INSERT INTO `Visitor` (
    `visitorId`,
    `visitorType`,
    `fullName`,
    `locationId`,
    `identificationNumber`,
    `govtId`,
    `groupHeadVisitorId`,
    `status`,
    `personToMeet`,
    `cardNumber`,
    `checkInTime`,
    `checkOutTime`,
    `createdBy`,
    `modifiedBy`,
    `createdAt`,
    `modifiedAt`
)
SELECT 'VIS003', 'EMPLOYEE', 'Corporate Team Lead', 'LOC002', 'PAN-3099', 'EMP-ID-3099', NULL, 'CheckedIn',
       'HR Team', 'CARD-003', CURRENT_TIMESTAMP - INTERVAL 1 HOUR, NULL,
       'admin', 'admin', CURRENT_TIMESTAMP - INTERVAL 1 HOUR, CURRENT_TIMESTAMP - INTERVAL 20 MINUTE
WHERE NOT EXISTS (SELECT 1 FROM `Visitor` WHERE `visitorId` = 'VIS003');

INSERT INTO `Visitor` (
    `visitorId`,
    `visitorType`,
    `fullName`,
    `locationId`,
    `identificationNumber`,
    `govtId`,
    `groupHeadVisitorId`,
    `status`,
    `personToMeet`,
    `cardNumber`,
    `checkInTime`,
    `checkOutTime`,
    `createdBy`,
    `modifiedBy`,
    `createdAt`,
    `modifiedAt`
)
SELECT 'VIS004', 'EMPLOYEE', 'Sneha Gupta', 'LOC002', 'AADHAAR-7788', 'EMP-ID-7788', 'VIS003', 'CheckedOut',
       'HR Team', 'CARD-004', CURRENT_TIMESTAMP - INTERVAL 1 HOUR, CURRENT_TIMESTAMP - INTERVAL 10 MINUTE,
       'admin', 'admin', CURRENT_TIMESTAMP - INTERVAL 1 HOUR, CURRENT_TIMESTAMP - INTERVAL 10 MINUTE
WHERE NOT EXISTS (SELECT 1 FROM `Visitor` WHERE `visitorId` = 'VIS004');

INSERT INTO `Visitor` (
    `visitorId`,
    `visitorType`,
    `fullName`,
    `locationId`,
    `identificationNumber`,
    `govtId`,
    `groupHeadVisitorId`,
    `status`,
    `personToMeet`,
    `cardNumber`,
    `checkInTime`,
    `checkOutTime`,
    `createdBy`,
    `modifiedBy`,
    `createdAt`,
    `modifiedAt`
)
SELECT 'VIS005', 'NONEMPLOYEE', 'Mohit Verma', 'LOC001', 'PAN-5521', 'INT-5521', NULL, 'CheckedIn',
       'Talent Acquisition', 'CARD-005', CURRENT_TIMESTAMP - INTERVAL 45 MINUTE, NULL,
       'admin', 'admin', CURRENT_TIMESTAMP - INTERVAL 45 MINUTE, CURRENT_TIMESTAMP - INTERVAL 5 MINUTE
WHERE NOT EXISTS (SELECT 1 FROM `Visitor` WHERE `visitorId` = 'VIS005');

