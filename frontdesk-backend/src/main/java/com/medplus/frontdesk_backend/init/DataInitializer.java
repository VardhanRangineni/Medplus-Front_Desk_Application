package com.medplus.frontdesk_backend.init;

import com.medplus.frontdesk_backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Seeds the frontdesk database with initial location and user data on every
 * application startup (idempotent — skips records that already exist).
 *
 * Insert order respects FK constraints:
 *   1. locationmaster
 *   2. usermaster
 *   3. usermanagement (FK → usermaster.employeeid AND locationmaster.LocationId)
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        log.info("=== DataInitializer: starting seed check ===");
        initLocation();
        initUserMasters();
        initUserManagement();
        log.info("=== DataInitializer: seed check complete ===");
    }

    // ── Step 1: Location ──────────────────────────────────────────────────────

    private void initLocation() {
        if (userRepository.existsLocation("HO-HO-HYD")) {
            log.info("[locationmaster] HO-HO-HYD already exists — skipping.");
            return;
        }
        userRepository.insertLocation(
                "HO-HO-HYD",
                "Medplus Head Office Hyderabad",
                "HEAD_OFFICE",
                "Medplus House, Plot No. 14, Survey No. 97, Balnagar Industrial Area, Balanagar",
                "Hyderabad",
                "Telangana",
                "500037",
                "CONFIGURED",
                "SYSTEM"
        );
        log.info("[locationmaster] HO-HO-HYD created.");
    }

    // ── Step 2: UserMaster (must exist before usermanagement FK) ─────────────

    private void initUserMasters() {
        insertUserMasterIfAbsent("Admin",      "Admin User",          "admin@medplus.com",      "9000000001", "Primary Administrator",  "Medplus Head Office Hyderabad", "Administration", "Administrator");
        insertUserMasterIfAbsent("Supervisor", "Supervisor",          "supervisor@medplus.com", "9000000002", "Supervisor",             "Medplus Head Office Hyderabad", "Operations",      "Supervisor");
        insertUserMasterIfAbsent("OTG001",     "Receptionist OTG001", "otg001@medplus.com",     "9000000003", "Receptionist",           "Medplus Head Office Hyderabad", "Front Desk",      "Receptionist");
    }

    private void insertUserMasterIfAbsent(String employeeId, String fullName, String email,
                                           String phone, String designation,
                                           String worklocation, String department, String role) {
        if (userRepository.existsInUserMaster(employeeId)) {
            log.info("[usermaster] {} already exists — skipping.", employeeId);
            return;
        }
        userRepository.insertUserMaster(employeeId, fullName, email, phone, designation, worklocation, department, role);
        log.info("[usermaster] Inserted: {} ({})", employeeId, fullName);
    }

    // ── Step 3: UserManagement (depends on usermaster + locationmaster) ───────

    private void initUserManagement() {
        insertUserManagementIfAbsent("Admin",      "Admin User",          "Admin",      "PRIMARY_ADMIN");
        insertUserManagementIfAbsent("Supervisor", "Supervisor",          "supervisor", "REGIONAL_ADMIN");
        insertUserManagementIfAbsent("OTG001",     "Receptionist OTG001", "user",       "RECEPTIONIST");
    }

    private void insertUserManagementIfAbsent(String employeeId, String fullName,
                                               String rawPassword, String role) {
        if (userRepository.existsInUserManagement(employeeId)) {
            log.info("[usermanagement] {} already exists — skipping.", employeeId);
            return;
        }
        String encoded = passwordEncoder.encode(rawPassword);
        userRepository.insertUserManagement(employeeId, fullName, encoded, "HO-HO-HYD", "ACTIVE", role, "0.0.0.0");
        log.info("[usermanagement] Inserted: {} ({}, role: {})", employeeId, fullName, role);
    }
}
