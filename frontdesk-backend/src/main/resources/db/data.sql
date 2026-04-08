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
     'SYSTEM'),

    ('SO-HO-HYD',
     'Medplus Software Office Hyderabad',
     'HEAD_OFFICE',
     'Medplus Software Office, Kavuri Enclave, Kavuri Hills, 3rd Floor, Hyderabad',
     'Hyderabad',
     'Telangana',
     '500081',
     'CONFIGURED',
     'SYSTEM')
ON DUPLICATE KEY UPDATE
    modifiedBy = 'SYSTEM';


-- ── 2. usermaster ────────────────────────────────────────────────────────────
--  HR employee profiles (no login credentials — those live in usermanagement).

INSERT INTO `usermaster`
    (employeeid, fullName, workemail, phone, designation, role, worklocation, department, createdBy)
VALUES
    ('OTG001',
     'Admin',
     'admin@medplus.com',
     '9000000001',
     'Primary Administrator',
     'Administrator',
     'Medplus Head Office Hyderabad',
     'Administration',
     'SYSTEM'),

    ('OTG002',
     'Supervisor',
     'supervisor@medplus.com',
     '9000000002',
     'Supervisor',
     'Supervisor',
     'Medplus Head Office Hyderabad',
     'Operations',
     'SYSTEM'),

    ('OTG003',
     'Receptionist',
     'otg001@medplus.com',
     '9000000003',
     'Receptionist',
     'Receptionist',
     'Medplus Head Office Hyderabad',
     'Front Desk',
     'SYSTEM'),

    ('OTG004',
     'Vardhan.R',
     'vardhan.r@medplus.com',
     '9000000004',
     'Software Developer',
     'Software Developer',
     'Medplus Software Office Hyderabad',
     'Software Development',
     'SYSTEM'),

    ('OTG005',
     'Rohit Varma.D',
     'rohit.varma.d@medplus.com',
     '9000000005',
     'Software Developer',
     'Software Developer',
     'Medplus Software Office Hyderabad',
     'Software Development',
     'SYSTEM'),

    ('OTG006',
     'Prabhas.M',
     'prabhas.m@medplus.com',
     '9000000006',
     'Software Developer',
     'Software Developer',
     'Medplus Software Office Hyderabad',
     'Software Development',
     'SYSTEM')
ON DUPLICATE KEY UPDATE
    modifiedBy = 'SYSTEM';


-- ── 3. usermanagement ────────────────────────────────────────────────────────
--  Login credentials and role assignments.
--  Passwords (BCrypt cost 10):
--    OTG001 / Admin      → "Admin"
--    OTG002 / Supervisor → "Supervisor"
--    OTG003 / OTG003     → "OTG003"
--
--  location FK → locationmaster.LocationId

INSERT INTO `usermanagement`
    (employeeid, fullName, ipaddress, password, location, status, role, createdBy)
VALUES
    ('OTG001',
     'Admin',
     '0.0.0.0',
     '$2a$10$wrR8NHUn5OEVubzndfIpUO4tmi88/DMqFVm7ZyhRF3ws82nGoFIYe',
     'HO-HO-HYD',
     'ACTIVE',
     'PRIMARY_ADMIN',
     'SYSTEM'),

    ('OTG002',
     'Supervisor',
     '0.0.0.0',
     '$2a$10$iUz7edgsyU/yUfV9csfJS..5bzaf6IAXHFEsOJmRY9Im/TwgWBFtq',
     'SO-HO-HYD',
     'ACTIVE',
     'REGIONAL_ADMIN',
     'SYSTEM'),

    ('OTG003',
     'Receptionist',
     '0.0.0.0',
     '$2a$10$TDEv.On5BdXIBtTgegtJseXwJ6h/rPztycu6Qgp23/fE5XlWrrhZu',
     'SO-HO-HYD',
     'ACTIVE',
     'RECEPTIONIST',
     'SYSTEM')
ON DUPLICATE KEY UPDATE
    modifiedBy = 'SYSTEM';
