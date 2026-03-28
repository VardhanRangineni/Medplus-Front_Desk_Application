package com.medplus.frontdesk.backend.dto.dashboard;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Carries all KPI breakdowns in a single response so the frontend
 * can switch between All / Employee / Non-Employee tabs without
 * making additional round-trips.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DashboardKpiDto {

    // ── Today's Check-ins ────────────────────────────────────────────────────
    private int checkInsAll;
    private int checkInsEmployee;
    private int checkInsNonEmployee;

    // ── Today's Check-outs ───────────────────────────────────────────────────
    private int checkOutsAll;
    private int checkOutsEmployee;
    private int checkOutsNonEmployee;

    // ── Currently Active in Building (live — no date range applied) ──────────
    private int activeInBuildingAll;
    private int activeInBuildingEmployee;
    private int activeInBuildingNonEmployee;
}
