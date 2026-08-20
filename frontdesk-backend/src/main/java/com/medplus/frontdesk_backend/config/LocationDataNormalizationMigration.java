package com.medplus.frontdesk_backend.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Aligns legacy location codes with kiosk {@code device_master.locationId} values.
 */
@Slf4j
@Component
@Order(300)
@RequiredArgsConstructor
public class LocationDataNormalizationMigration implements ApplicationRunner {

    private static final String CANONICAL_LOCATION = "MED-HO-00001";

    private final JdbcTemplate jdbc;

    @Override
    public void run(ApplicationArguments args) {
        if (!locationExists(CANONICAL_LOCATION)) {
            log.debug("[LocationNormalize] Canonical location {} not present — skipping remap", CANONICAL_LOCATION);
            return;
        }

        int fromDevice = jdbc.update("""
                UPDATE visitorlog v
                INNER JOIN device_master d ON d.deviceId = v.checkInDeviceId
                SET v.locationId = d.locationId
                WHERE v.checkInDeviceId IS NOT NULL
                  AND d.locationId IS NOT NULL
                  AND v.locationId <> d.locationId
                """);

        int legacyVisitor = jdbc.update("""
                UPDATE visitorlog
                SET locationId = ?
                WHERE locationId = 'HO-HO-HYD'
                """, CANONICAL_LOCATION);

        int legacyUsers = jdbc.update("""
                UPDATE usermanagement u
                INNER JOIN location_master lm ON lm.locationId = ?
                SET u.location = lm.locationId,
                    u.locationName = lm.descriptiveName
                WHERE u.location = 'HO-HO-HYD'
                """, CANONICAL_LOCATION);

        int legacyMappings = jdbc.update("""
                DELETE ulm FROM user_location_mapping ulm
                INNER JOIN user_location_mapping canon
                  ON canon.employeeId = ulm.employeeId
                 AND canon.locationId = ?
                WHERE ulm.locationId = 'HO-HO-HYD'
                """, CANONICAL_LOCATION);

        legacyMappings += jdbc.update("""
                UPDATE user_location_mapping
                SET locationId = ?
                WHERE locationId = 'HO-HO-HYD'
                """, CANONICAL_LOCATION);

        if (fromDevice > 0 || legacyVisitor > 0 || legacyUsers > 0 || legacyMappings > 0) {
            log.info("[LocationNormalize] visitorlog via device={}, HO-HO-HYD visitors={}, users={}, mappings={}",
                    fromDevice, legacyVisitor, legacyUsers, legacyMappings);
        }
    }

    private boolean locationExists(String locationId) {
        Integer count = jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM location_master WHERE locationId = ?
                """,
                Integer.class,
                locationId);
        return count != null && count > 0;
    }
}
