package com.medplus.frontdesk_backend.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Multi-location assignment for supervisors ({@code user_location_mapping}).
 * Back-fills from legacy {@code usermanagement.location}.
 */
@Slf4j
@Component
@Order(210)
@RequiredArgsConstructor
public class UserLocationMappingMigration implements ApplicationRunner {

    private final JdbcTemplate jdbc;

    @Override
    public void run(ApplicationArguments args) {
        createTableIfMissing();
        backfillFromProfileLocation();
    }

    private void createTableIfMissing() {
        Integer count = jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM information_schema.tables
                WHERE table_schema = DATABASE() AND table_name = 'user_location_mapping'
                """,
                Integer.class);
        if (count != null && count > 0) {
            return;
        }
        log.info("[UserLocationMapping] Creating user_location_mapping");
        jdbc.execute("""
                CREATE TABLE `user_location_mapping` (
                    `employeeId` VARCHAR(100) NOT NULL,
                    `locationId` VARCHAR(20)  NOT NULL,
                    `createdAt`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (`employeeId`, `locationId`),
                    KEY `idx_ulm_location` (`locationId`),
                    CONSTRAINT `fk_ulm_employee`
                        FOREIGN KEY (`employeeId`) REFERENCES `usermanagement` (`employeeid`) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
                """);
    }

    private void backfillFromProfileLocation() {
        int inserted = jdbc.update("""
                INSERT IGNORE INTO user_location_mapping (employeeId, locationId)
                SELECT employeeid, location
                FROM usermanagement
                WHERE location IS NOT NULL AND TRIM(location) <> ''
                """);
        if (inserted > 0) {
            log.info("[UserLocationMapping] Back-filled {} location mapping row(s)", inserted);
        }
    }
}
