-- ── Locations ────────────────────────────────────────────────────────────────

INSERT INTO `Locations` (
    `LocationId`, `descriptiveName`, `type`, `coordinates`,
    `address`, `city`, `state`, `pincode`, `status`,
    `createdBy`, `modifiedBy`, `createdAt`, `modifiedAt`
)
SELECT 'LOC001', 'Main Reception', 'RECEPTION', '17.3850,78.4867',
       'Front Desk, Medplus Campus', 'Hyderabad', 'Telangana', '500001',
       'CONFIGURED', 'admin', 'admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM `Locations` WHERE `LocationId` = 'LOC001');

INSERT INTO `Locations` (
    `LocationId`, `descriptiveName`, `type`, `coordinates`,
    `address`, `city`, `state`, `pincode`, `status`,
    `createdBy`, `modifiedBy`, `createdAt`, `modifiedAt`
)
SELECT 'LOC002', 'Admin Cabin', 'CABIN', '17.3855,78.4870',
       'Block A, First Floor', 'Hyderabad', 'Telangana', '500001',
       'CONFIGURED', 'admin', 'admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM `Locations` WHERE `LocationId` = 'LOC002');

INSERT INTO `Locations` (
    `LocationId`, `descriptiveName`, `type`, `coordinates`,
    `address`, `city`, `state`, `pincode`, `status`,
    `createdBy`, `modifiedBy`, `createdAt`, `modifiedAt`
)
SELECT 'LOC003', 'Corporate Office', 'OFFICE', '17.3862,78.4878',
       'Block B, Ground Floor', 'Hyderabad', 'Telangana', '500001',
       'CONFIGURED', 'admin', 'admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM `Locations` WHERE `LocationId` = 'LOC003');

-- ── Users ─────────────────────────────────────────────────────────────────────

INSERT INTO `User` (`username`, `password`, `Location`, `role`)
SELECT 'admin',
       '$2a$10$A.Tw6CL6bUVo1F3Jiwcsdu4s6eYVzIJPZvZpk/M9cCSNz3LrqYgcq',
       'LOC001',
       'ADMIN'
WHERE NOT EXISTS (SELECT 1 FROM `User` WHERE `username` = 'admin');

INSERT INTO `User` (`username`, `password`, `Location`, `role`)
SELECT 'frontdesk',
       '$2a$10$A.Tw6CL6bUVo1F3Jiwcsdu4s6eYVzIJPZvZpk/M9cCSNz3LrqYgcq',
       'LOC003',
       'USER'
WHERE NOT EXISTS (SELECT 1 FROM `User` WHERE `username` = 'frontdesk');

-- ── Visitors (spread across today's hours for a realistic chart) ──────────────

-- 8am arrivals
INSERT INTO `Visitor` (
    `visitorId`,`visitorType`,`fullName`,`locationId`,`identificationNumber`,`govtId`,
    `groupHeadVisitorId`,`status`,`personToMeet`,`cardNumber`,
    `checkInTime`,`checkOutTime`,`createdBy`,`modifiedBy`,`createdAt`,`modifiedAt`
)
SELECT 'VIS001','NONEMPLOYEE','Ravi Kumar','LOC001','AADHAAR-1001','DL-9001',NULL,'CheckedOut',
       'Priya Sharma','CARD-001',
       DATE_FORMAT(CURDATE(), '%Y-%m-%d 08:05:00'), DATE_FORMAT(CURDATE(), '%Y-%m-%d 10:30:00'),
       'admin','admin',DATE_FORMAT(CURDATE(), '%Y-%m-%d 08:05:00'),DATE_FORMAT(CURDATE(), '%Y-%m-%d 10:30:00')
WHERE NOT EXISTS (SELECT 1 FROM `Visitor` WHERE `visitorId` = 'VIS001');

INSERT INTO `Visitor` (
    `visitorId`,`visitorType`,`fullName`,`locationId`,`identificationNumber`,`govtId`,
    `groupHeadVisitorId`,`status`,`personToMeet`,`cardNumber`,
    `checkInTime`,`checkOutTime`,`createdBy`,`modifiedBy`,`createdAt`,`modifiedAt`
)
SELECT 'VIS002','EMPLOYEE','Anita Singh','LOC003','PAN-EMP-001','EMP-8201',NULL,'CheckedIn',
       'HR Team','CARD-002',
       DATE_FORMAT(CURDATE(), '%Y-%m-%d 08:20:00'), NULL,
       'admin','admin',DATE_FORMAT(CURDATE(), '%Y-%m-%d 08:20:00'),DATE_FORMAT(CURDATE(), '%Y-%m-%d 08:20:00')
WHERE NOT EXISTS (SELECT 1 FROM `Visitor` WHERE `visitorId` = 'VIS002');

-- 9am arrivals
INSERT INTO `Visitor` (
    `visitorId`,`visitorType`,`fullName`,`locationId`,`identificationNumber`,`govtId`,
    `groupHeadVisitorId`,`status`,`personToMeet`,`cardNumber`,
    `checkInTime`,`checkOutTime`,`createdBy`,`modifiedBy`,`createdAt`,`modifiedAt`
)
SELECT 'VIS003','NONEMPLOYEE','Kiran Mehta','LOC001','AADHAAR-2201','PAN-2201',NULL,'CheckedOut',
       'Operations Desk','CARD-003',
       DATE_FORMAT(CURDATE(), '%Y-%m-%d 09:10:00'), DATE_FORMAT(CURDATE(), '%Y-%m-%d 11:45:00'),
       'admin','admin',DATE_FORMAT(CURDATE(), '%Y-%m-%d 09:10:00'),DATE_FORMAT(CURDATE(), '%Y-%m-%d 11:45:00')
WHERE NOT EXISTS (SELECT 1 FROM `Visitor` WHERE `visitorId` = 'VIS003');

INSERT INTO `Visitor` (
    `visitorId`,`visitorType`,`fullName`,`locationId`,`identificationNumber`,`govtId`,
    `groupHeadVisitorId`,`status`,`personToMeet`,`cardNumber`,
    `checkInTime`,`checkOutTime`,`createdBy`,`modifiedBy`,`createdAt`,`modifiedAt`
)
SELECT 'VIS004','EMPLOYEE','Rahul Gupta','LOC003','PAN-EMP-002','EMP-9102',NULL,'CheckedIn',
       'Finance Dept','CARD-004',
       DATE_FORMAT(CURDATE(), '%Y-%m-%d 09:30:00'), NULL,
       'admin','admin',DATE_FORMAT(CURDATE(), '%Y-%m-%d 09:30:00'),DATE_FORMAT(CURDATE(), '%Y-%m-%d 09:30:00')
WHERE NOT EXISTS (SELECT 1 FROM `Visitor` WHERE `visitorId` = 'VIS004');

INSERT INTO `Visitor` (
    `visitorId`,`visitorType`,`fullName`,`locationId`,`identificationNumber`,`govtId`,
    `groupHeadVisitorId`,`status`,`personToMeet`,`cardNumber`,
    `checkInTime`,`checkOutTime`,`createdBy`,`modifiedBy`,`createdAt`,`modifiedAt`
)
SELECT 'VIS005','NONEMPLOYEE','Pooja Agarwal','LOC001','AADHAAR-3310','DL-3310',NULL,'CheckedIn',
       'Accounts Dept','CARD-005',
       DATE_FORMAT(CURDATE(), '%Y-%m-%d 09:50:00'), NULL,
       'admin','admin',DATE_FORMAT(CURDATE(), '%Y-%m-%d 09:50:00'),DATE_FORMAT(CURDATE(), '%Y-%m-%d 09:50:00')
WHERE NOT EXISTS (SELECT 1 FROM `Visitor` WHERE `visitorId` = 'VIS005');

-- 10am arrivals
INSERT INTO `Visitor` (
    `visitorId`,`visitorType`,`fullName`,`locationId`,`identificationNumber`,`govtId`,
    `groupHeadVisitorId`,`status`,`personToMeet`,`cardNumber`,
    `checkInTime`,`checkOutTime`,`createdBy`,`modifiedBy`,`createdAt`,`modifiedAt`
)
SELECT 'VIS006','NONEMPLOYEE','Sameer Jain','LOC003','AADHAAR-4421','PAN-4421',NULL,'CheckedIn',
       'Sunita Reddy','CARD-006',
       DATE_FORMAT(CURDATE(), '%Y-%m-%d 10:05:00'), NULL,
       'admin','admin',DATE_FORMAT(CURDATE(), '%Y-%m-%d 10:05:00'),DATE_FORMAT(CURDATE(), '%Y-%m-%d 10:05:00')
WHERE NOT EXISTS (SELECT 1 FROM `Visitor` WHERE `visitorId` = 'VIS006');

INSERT INTO `Visitor` (
    `visitorId`,`visitorType`,`fullName`,`locationId`,`identificationNumber`,`govtId`,
    `groupHeadVisitorId`,`status`,`personToMeet`,`cardNumber`,
    `checkInTime`,`checkOutTime`,`createdBy`,`modifiedBy`,`createdAt`,`modifiedAt`
)
SELECT 'VIS007','EMPLOYEE','Neha Sharma','LOC001','PAN-EMP-003','EMP-7731',NULL,'CheckedIn',
       'HR Team','CARD-007',
       DATE_FORMAT(CURDATE(), '%Y-%m-%d 10:25:00'), NULL,
       'admin','admin',DATE_FORMAT(CURDATE(), '%Y-%m-%d 10:25:00'),DATE_FORMAT(CURDATE(), '%Y-%m-%d 10:25:00')
WHERE NOT EXISTS (SELECT 1 FROM `Visitor` WHERE `visitorId` = 'VIS007');

-- 11am arrivals
INSERT INTO `Visitor` (
    `visitorId`,`visitorType`,`fullName`,`locationId`,`identificationNumber`,`govtId`,
    `groupHeadVisitorId`,`status`,`personToMeet`,`cardNumber`,
    `checkInTime`,`checkOutTime`,`createdBy`,`modifiedBy`,`createdAt`,`modifiedAt`
)
SELECT 'VIS008','NONEMPLOYEE','Arjun Mehta','LOC001','AADHAAR-5530','DL-5530',NULL,'CheckedOut',
       'Arjun Mehta','CARD-008',
       DATE_FORMAT(CURDATE(), '%Y-%m-%d 11:00:00'), DATE_FORMAT(CURDATE(), '%Y-%m-%d 12:30:00'),
       'admin','admin',DATE_FORMAT(CURDATE(), '%Y-%m-%d 11:00:00'),DATE_FORMAT(CURDATE(), '%Y-%m-%d 12:30:00')
WHERE NOT EXISTS (SELECT 1 FROM `Visitor` WHERE `visitorId` = 'VIS008');

INSERT INTO `Visitor` (
    `visitorId`,`visitorType`,`fullName`,`locationId`,`identificationNumber`,`govtId`,
    `groupHeadVisitorId`,`status`,`personToMeet`,`cardNumber`,
    `checkInTime`,`checkOutTime`,`createdBy`,`modifiedBy`,`createdAt`,`modifiedAt`
)
SELECT 'VIS009','NONEMPLOYEE','Deepika Rao','LOC003','AADHAAR-6610','PAN-6610',NULL,'CheckedIn',
       'Sunita Reddy','CARD-009',
       DATE_FORMAT(CURDATE(), '%Y-%m-%d 11:40:00'), NULL,
       'admin','admin',DATE_FORMAT(CURDATE(), '%Y-%m-%d 11:40:00'),DATE_FORMAT(CURDATE(), '%Y-%m-%d 11:40:00')
WHERE NOT EXISTS (SELECT 1 FROM `Visitor` WHERE `visitorId` = 'VIS009');

-- 12pm arrivals
INSERT INTO `Visitor` (
    `visitorId`,`visitorType`,`fullName`,`locationId`,`identificationNumber`,`govtId`,
    `groupHeadVisitorId`,`status`,`personToMeet`,`cardNumber`,
    `checkInTime`,`checkOutTime`,`createdBy`,`modifiedBy`,`createdAt`,`modifiedAt`
)
SELECT 'VIS010','EMPLOYEE','Vikram Nair','LOC001','PAN-EMP-004','EMP-3342',NULL,'CheckedOut',
       'Operations Head','CARD-010',
       DATE_FORMAT(CURDATE(), '%Y-%m-%d 12:05:00'), DATE_FORMAT(CURDATE(), '%Y-%m-%d 14:00:00'),
       'admin','admin',DATE_FORMAT(CURDATE(), '%Y-%m-%d 12:05:00'),DATE_FORMAT(CURDATE(), '%Y-%m-%d 14:00:00')
WHERE NOT EXISTS (SELECT 1 FROM `Visitor` WHERE `visitorId` = 'VIS010');

-- 1pm arrivals
INSERT INTO `Visitor` (
    `visitorId`,`visitorType`,`fullName`,`locationId`,`identificationNumber`,`govtId`,
    `groupHeadVisitorId`,`status`,`personToMeet`,`cardNumber`,
    `checkInTime`,`checkOutTime`,`createdBy`,`modifiedBy`,`createdAt`,`modifiedAt`
)
SELECT 'VIS011','NONEMPLOYEE','Ananya Singh','LOC003','AADHAAR-7720','DL-7720',NULL,'CheckedIn',
       'Sunita Reddy','CARD-011',
       DATE_FORMAT(CURDATE(), '%Y-%m-%d 13:15:00'), NULL,
       'admin','admin',DATE_FORMAT(CURDATE(), '%Y-%m-%d 13:15:00'),DATE_FORMAT(CURDATE(), '%Y-%m-%d 13:15:00')
WHERE NOT EXISTS (SELECT 1 FROM `Visitor` WHERE `visitorId` = 'VIS011');

INSERT INTO `Visitor` (
    `visitorId`,`visitorType`,`fullName`,`locationId`,`identificationNumber`,`govtId`,
    `groupHeadVisitorId`,`status`,`personToMeet`,`cardNumber`,
    `checkInTime`,`checkOutTime`,`createdBy`,`modifiedBy`,`createdAt`,`modifiedAt`
)
SELECT 'VIS012','EMPLOYEE','Karan Patel','LOC001','PAN-EMP-005','EMP-9981',NULL,'CheckedIn',
       'Director Office','CARD-012',
       DATE_FORMAT(CURDATE(), '%Y-%m-%d 13:45:00'), NULL,
       'admin','admin',DATE_FORMAT(CURDATE(), '%Y-%m-%d 13:45:00'),DATE_FORMAT(CURDATE(), '%Y-%m-%d 13:45:00')
WHERE NOT EXISTS (SELECT 1 FROM `Visitor` WHERE `visitorId` = 'VIS012');

-- 2pm arrivals
INSERT INTO `Visitor` (
    `visitorId`,`visitorType`,`fullName`,`locationId`,`identificationNumber`,`govtId`,
    `groupHeadVisitorId`,`status`,`personToMeet`,`cardNumber`,
    `checkInTime`,`checkOutTime`,`createdBy`,`modifiedBy`,`createdAt`,`modifiedAt`
)
SELECT 'VIS013','NONEMPLOYEE','Priya Sharma','LOC001','AADHAAR-8801','PAN-8801',NULL,'CheckedIn',
       'Arjun Mehta','CARD-013',
       DATE_FORMAT(CURDATE(), '%Y-%m-%d 14:00:00'), NULL,
       'admin','admin',DATE_FORMAT(CURDATE(), '%Y-%m-%d 14:00:00'),DATE_FORMAT(CURDATE(), '%Y-%m-%d 14:00:00')
WHERE NOT EXISTS (SELECT 1 FROM `Visitor` WHERE `visitorId` = 'VIS013');

INSERT INTO `Visitor` (
    `visitorId`,`visitorType`,`fullName`,`locationId`,`identificationNumber`,`govtId`,
    `groupHeadVisitorId`,`status`,`personToMeet`,`cardNumber`,
    `checkInTime`,`checkOutTime`,`createdBy`,`modifiedBy`,`createdAt`,`modifiedAt`
)
SELECT 'VIS014','NONEMPLOYEE','Mohit Verma','LOC003','AADHAAR-9912','DL-9912',NULL,'CheckedIn',
       'Talent Acquisition','CARD-014',
       DATE_FORMAT(CURDATE(), '%Y-%m-%d 14:30:00'), NULL,
       'admin','admin',DATE_FORMAT(CURDATE(), '%Y-%m-%d 14:30:00'),DATE_FORMAT(CURDATE(), '%Y-%m-%d 14:30:00')
WHERE NOT EXISTS (SELECT 1 FROM `Visitor` WHERE `visitorId` = 'VIS014');

-- 3pm arrivals
INSERT INTO `Visitor` (
    `visitorId`,`visitorType`,`fullName`,`locationId`,`identificationNumber`,`govtId`,
    `groupHeadVisitorId`,`status`,`personToMeet`,`cardNumber`,
    `checkInTime`,`checkOutTime`,`createdBy`,`modifiedBy`,`createdAt`,`modifiedAt`
)
SELECT 'VIS015','EMPLOYEE','Sonia Tiwari','LOC001','PAN-EMP-006','EMP-4456',NULL,'CheckedIn',
       'HR Team','CARD-015',
       DATE_FORMAT(CURDATE(), '%Y-%m-%d 15:10:00'), NULL,
       'admin','admin',DATE_FORMAT(CURDATE(), '%Y-%m-%d 15:10:00'),DATE_FORMAT(CURDATE(), '%Y-%m-%d 15:10:00')
WHERE NOT EXISTS (SELECT 1 FROM `Visitor` WHERE `visitorId` = 'VIS015');
