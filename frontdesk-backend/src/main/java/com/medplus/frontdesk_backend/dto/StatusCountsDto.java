package com.medplus.frontdesk_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Lightweight summary returned by GET /api/visitors/status-counts.
 * Used to populate the tab badges on the Check-In / Check-Out screen.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StatusCountsDto {

    /** Total entries visible to the caller (all statuses combined). */
    private long total;

    /** Number of entries currently checked in. */
    private long checkedIn;

    /** Number of entries that have been checked out. */
    private long checkedOut;
}
