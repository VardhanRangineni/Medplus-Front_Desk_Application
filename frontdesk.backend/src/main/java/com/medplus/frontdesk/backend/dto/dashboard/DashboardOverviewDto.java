package com.medplus.frontdesk.backend.dto.dashboard;

import java.time.LocalDate;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DashboardOverviewDto {
    private String appliedLocationId;
    private String appliedVisitorType;
    private LocalDate fromDate;
    private LocalDate toDate;
    private DashboardKpiDto kpis;
    private List<DashboardFlowPointDto> visitorFlow;
    private List<RecentVisitorDto> recentVisitors;
}

