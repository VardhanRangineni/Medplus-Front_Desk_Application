package com.medplus.frontdesk_backend.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Drops legacy PVC card inventory tables and visitorlog.cardCode on existing databases.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CardLegacyCleanupMigration implements ApplicationRunner {

    private final JdbcTemplate jdbc;

    @Override
    public void run(ApplicationArguments args) {
        dropTableIfExists("cardmaster");
        dropTableIfExists("cardrequests");
        dropColumnIfExists("visitorlog", "cardCode");
    }

    private void dropTableIfExists(String table) {
        Integer count = jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM information_schema.tables
                WHERE table_schema = DATABASE() AND table_name = ?
                """,
                Integer.class,
                table);
        if (count == null || count == 0) {
            return;
        }
        log.info("[CardCleanup] Dropping table {}", table);
        jdbc.execute("DROP TABLE `" + table + "`");
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
        log.info("[CardCleanup] Dropping {}.{}", table, column);
        jdbc.execute("ALTER TABLE `" + table + "` DROP COLUMN `" + column + "`");
    }
}
