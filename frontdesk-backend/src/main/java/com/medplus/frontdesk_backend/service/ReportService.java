package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.dto.ReportAvgDurationDto;
import com.medplus.frontdesk_backend.dto.ReportDeptSummaryDto;
import com.medplus.frontdesk_backend.dto.ReportFrequentVisitorDto;
import com.medplus.frontdesk_backend.dto.ReportRatioDto;
import com.medplus.frontdesk_backend.dto.ReportActiveCountDto;
import com.medplus.frontdesk_backend.dto.PagedResponseDto;
import com.medplus.frontdesk_backend.dto.ReportReceptionistEntryDto;
import com.medplus.frontdesk_backend.dto.StaffActivityFilterDto;
import com.medplus.frontdesk_backend.dto.ReportVisitTrendPointDto;
import com.medplus.frontdesk_backend.repository.ReportRepository;
import com.medplus.frontdesk_backend.security.AuthorizationHelper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReportService {

    private final ReportRepository reportRepository;
    private final LocationScopeService locationScopeService;
    private final AuthorizationHelper authorizationHelper;

    public List<ReportDeptSummaryDto> getDeptSummary(
            String callerEmployeeId, Authentication auth, String workstationMac,
            LocalDate from, LocalDate to, String locationIdParam, Boolean allLocations) {

        String locationId = locationScopeService.resolveReadScope(
                callerEmployeeId, workstationMac, auth, locationIdParam, allLocations);
        String dept = resolveDepartmentFilter(null, auth);
        log.debug("dept-summary from={} to={} location={} caller={}", from, to, locationId, callerEmployeeId);
        return reportRepository.findDeptSummary(from, to, locationId, dept);
    }

    public ReportRatioDto getVisitorRatio(
            String callerEmployeeId, Authentication auth, String workstationMac,
            LocalDate from, LocalDate to, String locationIdParam, Boolean allLocations,
            String department) {

        String locationId = locationScopeService.resolveReadScope(
                callerEmployeeId, workstationMac, auth, locationIdParam, allLocations);
        String dept = resolveDepartmentFilter(department, auth);
        return reportRepository.findVisitorRatio(from, to, locationId, dept);
    }

    public List<ReportAvgDurationDto> getAvgDuration(
            String callerEmployeeId, Authentication auth, String workstationMac,
            LocalDate from, LocalDate to, String locationIdParam, Boolean allLocations) {

        String locationId = locationScopeService.resolveReadScope(
                callerEmployeeId, workstationMac, auth, locationIdParam, allLocations);
        String dept = resolveDepartmentFilter(null, auth);
        return reportRepository.findAvgDuration(from, to, locationId, dept);
    }

    public List<ReportFrequentVisitorDto> getFrequentVisitors(
            String callerEmployeeId, Authentication auth, String workstationMac,
            LocalDate from, LocalDate to, int minVisits, String locationIdParam, Boolean allLocations) {

        String locationId = locationScopeService.resolveReadScope(
                callerEmployeeId, workstationMac, auth, locationIdParam, allLocations);
        String dept = resolveDepartmentFilter(null, auth);
        return reportRepository.findFrequentVisitors(from, to, locationId, minVisits, dept);
    }

    public List<ReportVisitTrendPointDto> getVisitTrend(
            String callerEmployeeId, Authentication auth, String workstationMac,
            LocalDate from, LocalDate to, String locationIdParam, Boolean allLocations,
            String department) {

        String locationId = locationScopeService.resolveReadScope(
                callerEmployeeId, workstationMac, auth, locationIdParam, allLocations);
        String dept = resolveDepartmentFilter(department, auth);
        return reportRepository.findVisitTrendByHour(from, to, locationId, dept);
    }

    public ReportActiveCountDto getActiveVisitorsNow(
            String callerEmployeeId, Authentication auth, String workstationMac,
            String locationIdParam, Boolean allLocations, String department) {

        String locationId = locationScopeService.resolveReadScope(
                callerEmployeeId, workstationMac, auth, locationIdParam, allLocations);
        String dept = resolveDepartmentFilter(department, auth);
        return new ReportActiveCountDto(reportRepository.findActiveVisitorsNow(locationId, dept));
    }

    public PagedResponseDto<ReportReceptionistEntryDto> getStaffActivity(
            String callerEmployeeId, Authentication auth, String workstationMac,
            StaffActivityFilterDto filters,
            LocalDate from, LocalDate to, String locationIdParam, Boolean allLocations,
            int page, int size) {

        if (!isAdmin(auth)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Staff activity reports are available to supervisors and admins only.");
        }
        if (filters == null || !filters.hasAnyFilter()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Enter at least one search or column filter.");
        }

        String locationId = locationScopeService.resolveReadScope(
                callerEmployeeId, workstationMac, auth, locationIdParam, allLocations);
        String supervisorScope = isPrimaryAdmin(auth) ? null : callerEmployeeId;
        int offset = page * size;

        long total = reportRepository.countStaffActivity(
                from, to, locationId, supervisorScope, filters);
        List<ReportReceptionistEntryDto> rows = reportRepository.findStaffActivityPaged(
                from, to, locationId, supervisorScope, filters, offset, size);

        return PagedResponseDto.of(rows, page, size, total);
    }

    private String resolveDepartmentFilter(String deptFromUi, Authentication auth) {
        // DEPT_HEAD: auto-scoped to their own department
        if (authorizationHelper.isDeptHead(auth)) {
            String callerDept = authorizationHelper.getUserDepartment(auth.getName());
            if (org.springframework.util.StringUtils.hasText(callerDept)) {
                return callerDept;
            }
            log.warn("DEPT_HEAD {} has no department — skipping department filter", auth.getName());
        }
        return deptFromUi;
    }

    private boolean isAdmin(Authentication auth) {
        if (auth == null) return false;
        return auth.getAuthorities().stream().anyMatch(a ->
                "ROLE_PRIMARY_ADMIN".equals(a.getAuthority()) ||
                "ROLE_REGIONAL_ADMIN".equals(a.getAuthority()));
    }

    private static boolean isPrimaryAdmin(Authentication auth) {
        if (auth == null) return false;
        return auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_PRIMARY_ADMIN".equals(a.getAuthority()));
    }
}
