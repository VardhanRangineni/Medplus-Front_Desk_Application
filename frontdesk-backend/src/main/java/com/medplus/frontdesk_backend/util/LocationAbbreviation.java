package com.medplus.frontdesk_backend.util;

/** Builds card-code prefixes from a location display name (e.g. "Medplus Head Office" → MHO). */
public final class LocationAbbreviation {

    private LocationAbbreviation() {}

    public static String fromDisplayName(String descriptiveName) {
        if (descriptiveName == null || descriptiveName.isBlank()) {
            return "LOC";
        }
        String[] words = descriptiveName.trim().split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (String w : words) {
            if (!w.isEmpty()) {
                sb.append(Character.toUpperCase(w.charAt(0)));
            }
        }
        return sb.toString();
    }
}
