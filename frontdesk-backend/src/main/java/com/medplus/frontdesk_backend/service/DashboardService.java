package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.dto.DashboardStatsDto;
import com.medplus.frontdesk_backend.dto.VisitorFlowPointDto;
import com.medplus.frontdesk_backend.repository.VisitorRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class DashboardService {

    private final VisitorRepository visitorRepository;
    private final LocationScopeService locationScopeService;

    public DashboardStatsDto getStats(String callerEmployeeId,
                                      Authentication auth,
                                      String workstationMac,
                                      String locationIdParam,
                                      Boolean allLocations) {
        String locationId = locationScopeService.resolveReadScope(
                callerEmployeeId, workstationMac, auth, locationIdParam, allLocations);

        DashboardStatsDto stats = visitorRepository.findDashboardStats(locationId);
        List<VisitorFlowPointDto> flow = visitorRepository.findHourlyFlow(locationId);
        stats.setVisitorFlow(flow);

        log.debug("Dashboard stats fetched for location={} by {}", locationId, callerEmployeeId);
        return stats;
    }
}
