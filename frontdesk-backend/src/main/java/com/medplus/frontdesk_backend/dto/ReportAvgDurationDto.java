package com.medplus.frontdesk_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Average visit duration per department for checked-out visits.
 * Returned as a list ordered by avgDurationMinutes descending.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReportAvgDurationDto {

    /** Department name. */
    private String department;

    /**
     * Average time (in minutes) between checkInTime and checkOutTime
     * for visits that have already checked out.
     */
    private double avgDurationMinutes;

    /** Number of completed (checked-out) visits contributing to the average. */
    private long visitCount;
}
