package com.medplus.frontdesk_backend.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Ensures {@code user_role_mapping} exists and back-fills rows from legacy {@code usermanagement.roleId}.
 */
@Slf4j
@Component
@Order(200)
@RequiredArgsConstructor
public class UserRoleMappingMigration implements ApplicationRunner {

    private final JdbcTemplate jdbc;

    @Override
    public void run(ApplicationArguments args) {
        createTableIfMissing();
        backfillFromPrimaryRole();
    }

    private void createTableIfMissing() {
        Integer count = jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM information_schema.tables
                WHERE table_schema = DATABASE() AND table_name = 'user_role_mapping'
                """,
                Integer.class);
        if (count != null && count > 0) {
            return;
        }
        log.info("[UserRoleMapping] Creating user_role_mapping");
        jdbc.execute("""
                CREATE TABLE `user_role_mapping` (
                    `employeeId` VARCHAR(100)      NOT NULL,
                    `roleId`     TINYINT UNSIGNED  NOT NULL,
                    `createdAt`  TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (`employeeId`, `roleId`),
                    KEY `idx_urm_role` (`roleId`),
                    CONSTRAINT `fk_urm_employee`
                        FOREIGN KEY (`employeeId`) REFERENCES `usermanagement` (`employeeid`) ON DELETE CASCADE,
                    CONSTRAINT `fk_urm_role`
                        FOREIGN KEY (`roleId`) REFERENCES `roles` (`id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
                """);
    }

    private void backfillFromPrimaryRole() {
        int inserted = jdbc.update("""
                INSERT IGNORE INTO user_role_mapping (employeeId, roleId)
                SELECT employeeid, roleId FROM usermanagement
                """);
        if (inserted > 0) {
            log.info("[UserRoleMapping] Back-filled {} role mapping row(s)", inserted);
        }
    }
}
