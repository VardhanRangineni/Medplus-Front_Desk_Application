package com.medplus.frontdesk_backend.util;

import org.springframework.util.StringUtils;

import java.util.Map;

/**
 * Maps legacy location codes from older installs to current {@code location_master} IDs.
 */
public final class LegacyLocationResolver {

    private static final Map<String, String> LEGACY_TO_CANONICAL = Map.of(
            "HO-HO-HYD", "MED-HO-00001"
    );

    private LegacyLocationResolver() {
    }

    public static String resolve(String locationId) {
        if (!StringUtils.hasText(locationId)) {
            return locationId;
        }
        String trimmed = locationId.trim();
        String canonical = LEGACY_TO_CANONICAL.get(trimmed.toUpperCase());
        return canonical != null ? canonical : trimmed;
    }
}
