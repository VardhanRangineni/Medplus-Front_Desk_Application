package com.medplus.frontdesk_backend.config;

/**
 * Device login enforcement mode.
 * LEGACY — user MAC/IP only (pre device_master).
 * HYBRID — device_master first, fall back to user MAC/IP.
 * DEVICE_ONLY — registered kiosk required.
 */
public enum DeviceAuthMode {
    LEGACY,
    HYBRID,
    DEVICE_ONLY;

    public static DeviceAuthMode from(String value) {
        if (value == null || value.isBlank()) {
            return HYBRID;
        }
        try {
            return DeviceAuthMode.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return HYBRID;
        }
    }
}
