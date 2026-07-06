package com.medplus.frontdesk_backend.util;

/**
 * Normalizes workstation MAC addresses for consistent comparison
 * (login binding, visitor log desk ownership).
 */
public final class WorkstationMacUtil {

    public static final String HEADER_NAME = "X-Workstation-Mac";

    private WorkstationMacUtil() {}

    public static String normalize(String mac) {
        if (mac == null || mac.isBlank()) {
            return "";
        }
        return mac.replace(":", "").replace("-", "").trim().toUpperCase();
    }

    public static boolean matches(String a, String b) {
        String na = normalize(a);
        String nb = normalize(b);
        return !na.isEmpty() && na.equals(nb);
    }

    /** Stores canonical form (uppercase, colon-separated) or null if blank. */
    public static String toStoredValue(String mac) {
        String n = normalize(mac);
        if (n.isEmpty()) {
            return null;
        }
        if (n.length() == 12) {
            return String.format("%s:%s:%s:%s:%s:%s",
                    n.substring(0, 2), n.substring(2, 4), n.substring(4, 6),
                    n.substring(6, 8), n.substring(8, 10), n.substring(10, 12));
        }
        return mac.trim().toUpperCase();
    }
}
