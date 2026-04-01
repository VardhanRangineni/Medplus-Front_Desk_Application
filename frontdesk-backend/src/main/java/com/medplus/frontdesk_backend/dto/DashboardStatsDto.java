package com.medplus.frontdesk_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Aggregated statistics returned by GET /api/dashboard/stats.
 * All counts are scoped to today's date and the caller's location
 * (or all locations for admins).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardStatsDto {

    // ── Today's check-in counts ───────────────────────────────────────────────

    /** Total check-ins today (all entry types). */
    private long todayCheckinsAll;

    /** Employee check-ins today. */
    private long todayCheckinsEmp;

    /** Visitor (non-employee) check-ins today. */
    private long todayCheckinsNonEmp;

    // ── Today's check-out counts ──────────────────────────────────────────────

    /** Total check-outs today (all entry types). */
    private long todayCheckoutsAll;

    /** Employee check-outs today. */
    private long todayCheckoutsEmp;

    /** Visitor check-outs today. */
    private long todayCheckoutsNonEmp;

    // ── Currently active in the building ─────────────────────────────────────

    /** Total entries currently inside the building (status = CHECKED_IN). */
    private long activeInBuildingAll;

    /** Employees currently inside the building. */
    private long activeInBuildingEmp;

    /** Visitors currently inside the building. */
    private long activeInBuildingNonEmp;

    /**
     * Number of today's visitors/employees who have not yet checked out.
     * Equals {@link #activeInBuildingAll} — exposed separately for the
     * summary banner ("N pending sign-outs").
     */
    private long pendingSignouts;

    // ── Hourly visitor flow ───────────────────────────────────────────────────

    /**
     * Hourly check-in counts for today.
     * Each entry covers one clock-hour that had at least one check-in.
     * Populated by DashboardService after the main stats query.
     */
    private List<VisitorFlowPointDto> visitorFlow;
}
