package com.medplus.frontdesk_backend.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Idempotent patch for existing databases created before visit-pass columns were added.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class VisitPassSchemaMigration implements ApplicationRunner {

    private final JdbcTemplate jdbc;

    @Override
    public void run(ApplicationArguments args) {
        addColumnIfMissing("visitCardImageUrl", "VARCHAR(500) DEFAULT NULL");
        addColumnIfMissing("visitCardShortUrl", "VARCHAR(200) DEFAULT NULL");
        addColumnIfMissing("visitCardSentAt", "TIMESTAMP DEFAULT NULL");
        addColumnIfMissing("visitCardSmsStatus", "VARCHAR(20) DEFAULT NULL");
        addColumnIfMissing("visitCardSmsError", "VARCHAR(255) DEFAULT NULL");
        addVisitReasonsUniqueKey();
    }

    private void addVisitReasonsUniqueKey() {
        Integer count = jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM information_schema.statistics
                WHERE table_schema = DATABASE()
                  AND table_name = 'visit_reasons'
                  AND index_name = 'uk_visit_reasons_type_name'
                """,
                Integer.class);
        if (count != null && count > 0) return;
        log.info("[VisitReasons] Deduplicating and adding unique key on (type, reasonName).");
        // Delete duplicate rows, keeping the smallest id per (type, reasonName)
        jdbc.update("""
                DELETE vr FROM visit_reasons vr
                WHERE vr.id NOT IN (
                    SELECT min_id FROM (
                        SELECT MIN(id) AS min_id
                        FROM visit_reasons
                        GROUP BY `type`, reasonName
                    ) kept
                )
                """);
        jdbc.execute("ALTER TABLE visit_reasons ADD UNIQUE KEY uk_visit_reasons_type_name (`type`, `reasonName`)");
    }

    private void addColumnIfMissing(String column, String definition) {
        Integer count = jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = DATABASE()
                  AND table_name = 'preregistrations'
                  AND column_name = ?
                """,
                Integer.class,
                column);
        if (count != null && count > 0) {
            return;
        }
        log.info("[VisitPass] Adding preregistrations.{}", column);
        jdbc.execute("ALTER TABLE preregistrations ADD COLUMN `" + column + "` " + definition);
    }
}
