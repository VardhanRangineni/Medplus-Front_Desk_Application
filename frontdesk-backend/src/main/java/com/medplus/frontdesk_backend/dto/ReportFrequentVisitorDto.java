package com.medplus.frontdesk_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * A visitor (entryType = VISITOR) who has checked in more than once
 * within the requested date range.
 * Returned as a list ordered by visitCount descending.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReportFrequentVisitorDto {

    /** Visitor's full name. */
    private String name;

    /** Visitor's mobile number. */
    private String mobile;

    /** Number of check-ins in the date range. */
    private long visitCount;

    /**
     * Most recent check-in timestamp (ISO-8601 string, e.g. 2026-03-28T14:35:00).
     * Formatted in SQL as DATE_FORMAT(MAX(checkInTime), '%Y-%m-%dT%H:%i:%s').
     */
    private String lastVisit;

    /**
     * Comma-separated list of distinct departments the visitor checked into
     * within the date range.
     */
    private String departments;
}
