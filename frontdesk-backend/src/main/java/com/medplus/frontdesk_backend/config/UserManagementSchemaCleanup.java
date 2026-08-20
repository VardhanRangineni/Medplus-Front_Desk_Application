package com.medplus.frontdesk_backend.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Drops legacy per-user desk fields superseded by {@code device_master} and
 * {@code assignedDeviceId}. Receptionists no longer store location on the user row.
 */
@Slf4j
@Component
@Order(220)
@RequiredArgsConstructor
public class UserManagementSchemaCleanup implements ApplicationRunner {

    private final JdbcTemplate jdbc;

    @Override
    public void run(ApplicationArguments args) {
        clearReceptionistLocations();
        dropColumnIfExists("usermanagement", "profileRole");
        dropColumnIfExists("usermanagement", "ipaddress");
        dropColumnIfExists("usermanagement", "macaddress");
    }

    private void clearReceptionistLocations() {
        int updated = jdbc.update("""
                UPDATE usermanagement
                SET location = '', locationName = ''
                WHERE roleId = 3
                  AND (location <> '' OR locationName <> '')
                """);
        if (updated > 0) {
            log.info("[UserSchema] Cleared location on {} receptionist row(s)", updated);
        }
    }

    private void dropColumnIfExists(String table, String column) {
        Integer count = jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = DATABASE()
                  AND table_name = ?
                  AND column_name = ?
                """,
                Integer.class,
                table,
                column);
        if (count == null || count == 0) {
            return;
        }
        log.info("[UserSchema] Dropping {}.{}", table, column);
        jdbc.execute("ALTER TABLE `" + table + "` DROP COLUMN `" + column + "`");
    }
}
