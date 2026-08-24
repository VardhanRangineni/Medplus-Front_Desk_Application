package com.medplus.frontdesk_backend.model;

/**
 * Visit reason category — distinguishes visitor reasons from employee reasons.
 * Matches the database ENUM('VISITOR','EMPLOYEE').
 */
public enum VisitReasonType {
    VISITOR,
    EMPLOYEE
}
