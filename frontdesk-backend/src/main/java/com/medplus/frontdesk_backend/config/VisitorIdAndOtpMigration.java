package com.medplus.frontdesk_backend.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;

@Slf4j
@Component
@Order(140)
@RequiredArgsConstructor
public class VisitorIdAndOtpMigration implements ApplicationRunner {

    private final DataSource dataSource;

    @Override
    public void run(ApplicationArguments args) throws Exception {
        try (Connection conn = dataSource.getConnection()) {
            boolean acquired = acquireLock(conn);
            if (!acquired) {
                log.error("[VisitorIdAndOtpMigration] Failed to acquire named lock 'mvms_migration_lock' within 60s. Aborting startup.");
                throw new IllegalStateException("Failed to acquire migration named lock. Aborting startup to prevent migration race condition.");
            }
            try {
                runMigration(conn);
            } finally {
                releaseLock(conn);
            }
        }
    }

    private boolean acquireLock(Connection conn) throws Exception {
        log.info("[VisitorIdAndOtpMigration] Acquiring named lock 'mvms_migration_lock' with 60s timeout");
        try (PreparedStatement ps = conn.prepareStatement("SELECT GET_LOCK('mvms_migration_lock', 60)")) {
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    int val = rs.getInt(1);
                    if (val == 1) {
                        log.info("[VisitorIdAndOtpMigration] Named lock 'mvms_migration_lock' acquired successfully");
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private void releaseLock(Connection conn) {
        log.info("[VisitorIdAndOtpMigration] Releasing named lock 'mvms_migration_lock'");
        try (PreparedStatement ps = conn.prepareStatement("SELECT RELEASE_LOCK('mvms_migration_lock')")) {
            ps.executeQuery();
        } catch (Exception ex) {
            log.warn("[VisitorIdAndOtpMigration] Failed to release named lock: {}", ex.getMessage());
        }
    }

    private void runMigration(Connection conn) throws Exception {
        createOtpTokensTable(conn);
        addSeqIdColumnToVisitorLog(conn);
    }

    private void createOtpTokensTable(Connection conn) throws Exception {
        if (tableExists(conn, "otp_tokens")) {
            return;
        }
        log.info("[VisitorIdAndOtpMigration] Creating otp_tokens table");
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("""
                CREATE TABLE `otp_tokens` (
                    `mobile_number` VARCHAR(20) NOT NULL,
                    `token`         VARCHAR(1000) NOT NULL COMMENT 'Stores OAuth access token used during OTP request',
                    `created_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    `expires_at`    TIMESTAMP NOT NULL,
                    PRIMARY KEY (`mobile_number`),
                    KEY `idx_otp_expires` (`expires_at`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
                """);
        }
    }

    private void addSeqIdColumnToVisitorLog(Connection conn) throws Exception {
        boolean colExists = columnExists(conn, "visitorlog", "seq_id");
        boolean isAutoInc = colExists && isSeqIdAutoIncrement(conn);

        if (isAutoInc) {
            return;
        }

        if (!colExists) {
            log.info("[VisitorIdAndOtpMigration] Adding seq_id column to visitorlog");
            try (Statement stmt = conn.createStatement()) {
                stmt.execute("ALTER TABLE `visitorlog` ADD COLUMN `seq_id` BIGINT NULL");
            }
        }

        backfillSeqId(conn);

        log.info("[VisitorIdAndOtpMigration] Modifying seq_id to NOT NULL AUTO_INCREMENT UNIQUE KEY");
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("ALTER TABLE `visitorlog` MODIFY COLUMN `seq_id` BIGINT NOT NULL AUTO_INCREMENT, ADD UNIQUE KEY `uk_visitorlog_seq_id` (`seq_id`)");
        }

        long startVal = 1;
        try (Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT COALESCE(MAX(seq_id), 0) FROM visitorlog")) {
            if (rs.next()) {
                startVal = rs.getLong(1) + 1;
            }
        }
        log.info("[VisitorIdAndOtpMigration] Setting AUTO_INCREMENT to {}", startVal);
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("ALTER TABLE `visitorlog` AUTO_INCREMENT = " + startVal);
        }
    }

    private boolean isSeqIdAutoIncrement(Connection conn) throws Exception {
        try (PreparedStatement ps = conn.prepareStatement("""
                SELECT extra FROM information_schema.columns
                WHERE table_schema = DATABASE()
                  AND table_name = 'visitorlog'
                  AND column_name = 'seq_id'
                """)) {
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    String extra = rs.getString("extra");
                    return extra != null && extra.contains("auto_increment");
                }
            }
        }
        return false;
    }

    private void backfillSeqId(Connection conn) throws Exception {
        log.info("[VisitorIdAndOtpMigration] Starting chronological backfill of seq_id");

        java.util.List<String> visitorIds = new java.util.ArrayList<>();
        try (Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT visitorId FROM visitorlog ORDER BY checkInTime ASC, visitorId ASC")) {
            while (rs.next()) {
                visitorIds.add(rs.getString("visitorId"));
            }
        }

        if (visitorIds.isEmpty()) {
            return;
        }

        java.util.Set<Long> assigned = new java.util.HashSet<>();
        java.util.List<String> overlapping = new java.util.ArrayList<>();
        java.util.Map<String, Long> updates = new java.util.HashMap<>();

        for (String visitorId : visitorIds) {
            long parsed = parseNumericPart(visitorId);
            if (parsed > 0 && !assigned.contains(parsed)) {
                updates.put(visitorId, parsed);
                assigned.add(parsed);
            } else {
                overlapping.add(visitorId);
            }
        }

        long nextVal = 1;
        for (String visitorId : overlapping) {
            while (assigned.contains(nextVal)) {
                nextVal++;
            }
            updates.put(visitorId, nextVal);
            assigned.add(nextVal);
            nextVal++;
        }

        log.info("[VisitorIdAndOtpMigration] Performing batch update of seq_id for {} rows", updates.size());
        try (PreparedStatement ps = conn.prepareStatement("UPDATE visitorlog SET seq_id = ? WHERE visitorId = ?")) {
            int batchCount = 0;
            for (java.util.Map.Entry<String, Long> entry : updates.entrySet()) {
                ps.setLong(1, entry.getValue());
                ps.setString(2, entry.getKey());
                ps.addBatch();
                batchCount++;
                if (batchCount % 1000 == 0) {
                    ps.executeBatch();
                }
            }
            if (batchCount % 1000 != 0) {
                ps.executeBatch();
            }
        }
        log.info("[VisitorIdAndOtpMigration] Backfill completed successfully");
    }

    private long parseNumericPart(String visitorId) {
        if (visitorId == null) return 0;
        int lastDash = visitorId.lastIndexOf('-');
        if (lastDash == -1) return 0;
        try {
            return Long.parseLong(visitorId.substring(lastDash + 1));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private boolean tableExists(Connection conn, String table) throws Exception {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?")) {
            ps.setString(1, table);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return rs.getInt(1) > 0;
                }
            }
        }
        return false;
    }

    private boolean columnExists(Connection conn, String table, String column) throws Exception {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?")) {
            ps.setString(1, table);
            ps.setString(2, column);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return rs.getInt(1) > 0;
                }
            }
        }
        return false;
    }
}
