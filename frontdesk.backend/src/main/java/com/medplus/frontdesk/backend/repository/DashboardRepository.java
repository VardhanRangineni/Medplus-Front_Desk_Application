package com.medplus.frontdesk.backend.repository;

import java.time.LocalDateTime;
import java.util.List;

import com.medplus.frontdesk.backend.dto.dashboard.DashboardFlowPointDto;
import com.medplus.frontdesk.backend.dto.dashboard.DashboardKpiDto;
import com.medplus.frontdesk.backend.dto.dashboard.LocationOptionDto;
import com.medplus.frontdesk.backend.dto.dashboard.RecentVisitorDto;

public interface DashboardRepository {

    /**
     * Returns all nine KPI breakdown values at once (no visitorType filter —
     * the DTO itself carries All / Employee / NonEmployee counts).
     * The date window is applied to check-in and check-out counts only;
     * "active in building" is always the live, real-time count.
     */
    DashboardKpiDto fetchKpis(LocalDateTime start, LocalDateTime end, String locationId);

    List<DashboardFlowPointDto> fetchVisitorFlow(
            LocalDateTime start,
            LocalDateTime end,
            String locationId,
            String visitorType);

    List<RecentVisitorDto> fetchRecentVisitors(
            LocalDateTime start,
            LocalDateTime end,
            String locationId,
            String visitorType,
            int limit);

    /**
     * Paginated, filterable table query used by the dashboard visitors table.
     *
     * @param status  "ALL" | "CheckedIn" | "CheckedOut"
     * @param search  optional substring matched against fullName and identificationNumber
     * @param offset  SQL OFFSET (page * pageSize)
     * @param limit   SQL LIMIT  (pageSize)
     */
    List<RecentVisitorDto> fetchVisitorsPaged(
            LocalDateTime start,
            LocalDateTime end,
            String locationId,
            String visitorType,
            String status,
            String search,
            int offset,
            int limit);

    /** Total row count for the same filters – needed to compute totalPages. */
    int countVisitorsTotal(
            LocalDateTime start,
            LocalDateTime end,
            String locationId,
            String visitorType,
            String status,
            String search);

    List<LocationOptionDto> fetchLocations();
}
