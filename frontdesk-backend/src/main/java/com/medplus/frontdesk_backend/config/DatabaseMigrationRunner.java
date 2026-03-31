package com.medplus.frontdesk_backend.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Runs idempotent schema migrations on every startup, after the DataSource
 * is fully initialised (schema-init.sql + data.sql have already been applied).
 *
 * Why not schema-init.sql?
 *   MySQL does not support ALTER TABLE ... ADD COLUMN IF NOT EXISTS.
 *   Doing it in Java gives us proper existence checks with zero SQL-escaping risk.
 *
 * Add new migrations as private methods and call them from run().
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DatabaseMigrationRunner implements ApplicationRunner {

    private final JdbcTemplate jdbc;

    @Override
    public void run(ApplicationArguments args) {
        log.info("Running database migrations...");
        addColumnIfMissing("visitorlog", "govtIdType",
                "ENUM('AADHAAR','PAN','PASSPORT','VOTER','DL') DEFAULT NULL " +
                "COMMENT 'Government-issued ID type'",
                "AFTER `cardNumber`");
        addColumnIfMissing("visitorlog", "govtIdNumber",
                "VARCHAR(60) DEFAULT NULL " +
                "COMMENT 'Government ID number (masked or full)'",
                "AFTER `govtIdType`");
        addColumnIfMissing("visitorlog", "imageUrl",
                "VARCHAR(500) DEFAULT NULL " +
                "COMMENT 'Visitor photo URL — local path now, swap to cloud storage URL when ready'",
                "AFTER `govtIdNumber`");
        log.info("Database migrations complete.");
    }

    /**
     * Adds a column to a table only if it does not already exist.
     *
     * @param table      table name
     * @param column     column name
     * @param definition column type + constraints (e.g. "VARCHAR(60) DEFAULT NULL")
     * @param position   optional positional clause (e.g. "AFTER `cardNumber`"), or null
     */
    private void addColumnIfMissing(String table, String column, String definition, String position) {
        String schema = jdbc.queryForObject("SELECT DATABASE()", String.class);
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.COLUMNS " +
                "WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?",
                Integer.class, schema, table, column);

        if (count != null && count == 0) {
            String pos = (position != null && !position.isBlank()) ? " " + position : "";
            String sql = String.format("ALTER TABLE `%s` ADD COLUMN `%s` %s%s", table, column, definition, pos);
            jdbc.execute(sql);
            log.info("Migration applied: added column `{}` to `{}`", column, table);
        } else {
            log.debug("Migration skipped: column `{}` already exists in `{}`", column, table);
        }
    }
}
