package com.medplus.frontdesk_backend.model;

public enum VisitStatus {
    CHECKED_IN,
    CHECKED_OUT;

    /** Returns the frontend-friendly lowercase-hyphenated label. */
    public String toLabel() {
        return this == CHECKED_IN ? "checked-in" : "checked-out";
    }

    public static VisitStatus fromLabel(String label) {
        if ("checked-in".equalsIgnoreCase(label) || "CHECKED_IN".equalsIgnoreCase(label)) return CHECKED_IN;
        if ("checked-out".equalsIgnoreCase(label) || "CHECKED_OUT".equalsIgnoreCase(label)) return CHECKED_OUT;
        throw new IllegalArgumentException("Unknown visit status: " + label);
    }
}
