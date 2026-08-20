package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.dto.DashboardStatsDto;
import com.medplus.frontdesk_backend.dto.VisitorFlowPointDto;
import com.medplus.frontdesk_backend.repository.VisitorRepository;
import com.medplus.frontdesk_backend.security.AuthorizationHelper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class DashboardService {

    private final VisitorRepository visitorRepository;
    private final LocationScopeService locationScopeService;
    private final AuthorizationHelper authorizationHelper;

    public DashboardStatsDto getStats(String callerEmployeeId,
                                      Authentication auth,
                                      String workstationMac,
                                      String locationIdParam,
                                      Boolean allLocations) {
        String locationId = locationScopeService.resolveReadScope(
                callerEmployeeId, workstationMac, auth, locationIdParam, allLocations);
        String dept = resolveDeptScope(auth);

        DashboardStatsDto stats = visitorRepository.findDashboardStats(locationId, dept);
        List<VisitorFlowPointDto> flow = visitorRepository.findHourlyFlow(locationId, dept);
        stats.setVisitorFlow(flow);

        log.debug("Dashboard stats fetched for location={} dept={} by {}", locationId, dept, callerEmployeeId);
        return stats;
    }

    private String resolveDeptScope(Authentication auth) {
        if (authorizationHelper.isDeptHead(auth)) {
            String callerDept = authorizationHelper.getUserDepartment(auth.getName());
            if (StringUtils.hasText(callerDept)) return callerDept;
            log.warn("DEPT_HEAD {} has no department — skipping department filter for dashboard", auth.getName());
        }
        return null;
    }
}
