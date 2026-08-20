package com.medplus.frontdesk_backend.model;

public enum VisitStatus {
    PENDING_APPROVAL,
    /** Host approved — ready for desk check-in / on-site handling. Not yet CHECKED_IN. */
    APPROVED,
    CHECKED_IN,
    REJECTED,
    CHECKED_OUT;

    /** Returns the frontend-friendly lowercase-hyphenated label. */
    public String toLabel() {
        return switch (this) {
            case PENDING_APPROVAL -> "pending-approval";
            case APPROVED -> "approved";
            case CHECKED_IN -> "checked-in";
            case REJECTED -> "rejected";
            case CHECKED_OUT -> "checked-out";
        };
    }

    public static VisitStatus fromLabel(String label) {
        if (label == null || label.isBlank()) {
            throw new IllegalArgumentException("Unknown visit status: " + label);
        }
        String n = label.trim();
        if ("pending-approval".equalsIgnoreCase(n) || "PENDING_APPROVAL".equalsIgnoreCase(n)) {
            return PENDING_APPROVAL;
        }
        if ("approved".equalsIgnoreCase(n) || "APPROVED".equalsIgnoreCase(n)
                || "ready-for-checkin".equalsIgnoreCase(n) || "READY_FOR_CHECKIN".equalsIgnoreCase(n)) {
            return APPROVED;
        }
        if ("checked-in".equalsIgnoreCase(n) || "CHECKED_IN".equalsIgnoreCase(n)) {
            return CHECKED_IN;
        }
        if ("rejected".equalsIgnoreCase(n) || "REJECTED".equalsIgnoreCase(n)) {
            return REJECTED;
        }
        if ("checked-out".equalsIgnoreCase(n) || "CHECKED_OUT".equalsIgnoreCase(n)) {
            return CHECKED_OUT;
        }
        throw new IllegalArgumentException("Unknown visit status: " + label);
    }

    /** Still on site (awaiting host, host-approved, or checked in). */
    public boolean isOnSite() {
        return this == PENDING_APPROVAL || this == APPROVED || this == CHECKED_IN;
    }
}
