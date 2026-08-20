package com.medplus.frontdesk_backend.model;

public enum UserRole {
    PRIMARY_ADMIN,
    REGIONAL_ADMIN,
    RECEPTIONIST,
    /** Department Head — sees only Check-In/Out and Reports filtered by their own department. */
    DEPT_HEAD
}
