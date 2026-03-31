-- =============================================================================
--  Medplus Front Desk Application — Seed Data
--  Runs automatically on every startup (after schema-init.sql).
--  All statements are idempotent — safe to re-run, no duplicate-key errors.
-- =============================================================================

-- ── 1. locationmaster ────────────────────────────────────────────────────────

INSERT INTO `locationmaster`
    (LocationId, descriptiveName, type, address, city, state, pincode, status, createdBy)
VALUES
    ('HO-HO-HYD',
     'Medplus Head Office Hyderabad',
     'HEAD_OFFICE',
     'Medplus House, Plot No. 14, Survey No. 97, Balnagar Industrial Area, Balanagar',
     'Hyderabad',
     'Telangana',
     '500037',
     'CONFIGURED',
     'SYSTEM')
ON DUPLICATE KEY UPDATE
    modifiedBy = 'SYSTEM';


-- ── 2. usermaster ────────────────────────────────────────────────────────────
--  Passwords: employeeid == password (BCrypt cost 10, pre-computed)

INSERT INTO `usermaster`
    (employeeid, fullName, workemail, phone, designation, role, worklocation, department, createdBy)
VALUES
    ('Admin',
     'Admin User',
     'admin@medplus.com',
     '9000000001',
     'Primary Administrator',
     'Administrator',
     'Medplus Head Office Hyderabad',
     'Administration',
     'SYSTEM'),

    ('Supervisor',
     'Supervisor',
     'supervisor@medplus.com',
     '9000000002',
     'Supervisor',
     'Supervisor',
     'Medplus Head Office Hyderabad',
     'Operations',
     'SYSTEM'),

    ('OTG001',
     'Receptionist OTG001',
     'otg001@medplus.com',
     '9000000003',
     'Receptionist',
     'Receptionist',
     'Medplus Head Office Hyderabad',
     'Front Desk',
     'SYSTEM')
ON DUPLICATE KEY UPDATE
    modifiedBy = 'SYSTEM';


-- ── 3. usermanagement ────────────────────────────────────────────────────────
--  Passwords match employeeid (BCrypt cost 10):
--    Admin      → "Admin"
--    Supervisor → "Supervisor"
--    OTG001     → "OTG001"
--
--  location FK → locationmaster.LocationId (HO-HO-HYD must exist first)

INSERT INTO `usermanagement`
    (employeeid, fullName, ipaddress, password, location, status, role, createdBy)
VALUES
    ('Admin',
     'Admin User',
     '0.0.0.0',
     '$2a$10$wrR8NHUn5OEVubzndfIpUO4tmi88/DMqFVm7ZyhRF3ws82nGoFIYe',
     'HO-HO-HYD',
     'ACTIVE',
     'PRIMARY_ADMIN',
     'SYSTEM'),

    ('Supervisor',
     'Supervisor',
     '0.0.0.0',
     '$2a$10$iUz7edgsyU/yUfV9csfJS..5bzaf6IAXHFEsOJmRY9Im/TwgWBFtq',
     'HO-HO-HYD',
     'ACTIVE',
     'REGIONAL_ADMIN',
     'SYSTEM'),

    ('OTG001',
     'Receptionist OTG001',
     '0.0.0.0',
     '$2a$10$TDEv.On5BdXIBtTgegtJseXwJ6h/rPztycu6Qgp23/fE5XlWrrhZu',
     'HO-HO-HYD',
     'ACTIVE',
     'RECEPTIONIST',
     'SYSTEM')
ON DUPLICATE KEY UPDATE
    modifiedBy = 'SYSTEM';
