package com.medplus.frontdesk_backend.controller;

import com.medplus.frontdesk_backend.dto.ApiResponse;
import com.medplus.frontdesk_backend.dto.ReportAvgDurationDto;
import com.medplus.frontdesk_backend.dto.ReportDeptSummaryDto;
import com.medplus.frontdesk_backend.dto.ReportFrequentVisitorDto;
import com.medplus.frontdesk_backend.dto.ReportRatioDto;
import com.medplus.frontdesk_backend.dto.ReportActiveCountDto;
import com.medplus.frontdesk_backend.dto.PagedResponseDto;
import com.medplus.frontdesk_backend.dto.ReportReceptionistEntryDto;
import com.medplus.frontdesk_backend.dto.StaffActivityFilterDto;
import com.medplus.frontdesk_backend.dto.ReportVisitTrendPointDto;
import com.medplus.frontdesk_backend.service.ReportService;
import com.medplus.frontdesk_backend.util.WorkstationMacUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    @GetMapping("/department-summary")
    public ResponseEntity<ApiResponse<List<ReportDeptSummaryDto>>> getDeptSummary(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String locationId,
            @RequestParam(required = false) Boolean allLocations,
            @RequestHeader(value = WorkstationMacUtil.HEADER_NAME, required = false) String workstationMac,
            Authentication auth) {

        List<ReportDeptSummaryDto> data = reportService.getDeptSummary(
                auth.getName(), auth, workstationMac, from, to, locationId, allLocations);
        return ResponseEntity.ok(ApiResponse.success("Department summary retrieved.", data));
    }

    @GetMapping("/visitor-ratio")
    public ResponseEntity<ApiResponse<ReportRatioDto>> getVisitorRatio(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String locationId,
            @RequestParam(required = false) Boolean allLocations,
            @RequestParam(required = false) String department,
            @RequestHeader(value = WorkstationMacUtil.HEADER_NAME, required = false) String workstationMac,
            Authentication auth) {

        ReportRatioDto data = reportService.getVisitorRatio(
                auth.getName(), auth, workstationMac, from, to, locationId, allLocations, department);
        return ResponseEntity.ok(ApiResponse.success("Visitor ratio retrieved.", data));
    }

    @GetMapping("/avg-duration")
    public ResponseEntity<ApiResponse<List<ReportAvgDurationDto>>> getAvgDuration(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String locationId,
            @RequestParam(required = false) Boolean allLocations,
            @RequestHeader(value = WorkstationMacUtil.HEADER_NAME, required = false) String workstationMac,
            Authentication auth) {

        List<ReportAvgDurationDto> data = reportService.getAvgDuration(
                auth.getName(), auth, workstationMac, from, to, locationId, allLocations);
        return ResponseEntity.ok(ApiResponse.success("Average duration retrieved.", data));
    }

    @GetMapping("/frequent-visitors")
    public ResponseEntity<ApiResponse<List<ReportFrequentVisitorDto>>> getFrequentVisitors(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "2") int minVisits,
            @RequestParam(required = false) String locationId,
            @RequestParam(required = false) Boolean allLocations,
            @RequestHeader(value = WorkstationMacUtil.HEADER_NAME, required = false) String workstationMac,
            Authentication auth) {

        List<ReportFrequentVisitorDto> data = reportService.getFrequentVisitors(
                auth.getName(), auth, workstationMac, from, to, minVisits, locationId, allLocations);
        return ResponseEntity.ok(ApiResponse.success("Frequent visitors retrieved.", data));
    }

    @GetMapping("/visit-trend")
    public ResponseEntity<ApiResponse<List<ReportVisitTrendPointDto>>> getVisitTrend(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String locationId,
            @RequestParam(required = false) Boolean allLocations,
            @RequestParam(required = false) String department,
            @RequestHeader(value = WorkstationMacUtil.HEADER_NAME, required = false) String workstationMac,
            Authentication auth) {

        List<ReportVisitTrendPointDto> data = reportService.getVisitTrend(
                auth.getName(), auth, workstationMac, from, to, locationId, allLocations, department);
        return ResponseEntity.ok(ApiResponse.success("Visit trend retrieved.", data));
    }

    @GetMapping("/active-now")
    public ResponseEntity<ApiResponse<ReportActiveCountDto>> getActiveNow(
            @RequestParam(required = false) String locationId,
            @RequestParam(required = false) Boolean allLocations,
            @RequestParam(required = false) String department,
            @RequestHeader(value = WorkstationMacUtil.HEADER_NAME, required = false) String workstationMac,
            Authentication auth) {

        ReportActiveCountDto data = reportService.getActiveVisitorsNow(
                auth.getName(), auth, workstationMac, locationId, allLocations, department);
        return ResponseEntity.ok(ApiResponse.success("Active visitors retrieved.", data));
    }

    @GetMapping("/receptionist-activity")
    public ResponseEntity<ApiResponse<PagedResponseDto<ReportReceptionistEntryDto>>> getStaffActivity(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String visitorName,
            @RequestParam(required = false) String contactQuery,
            @RequestParam(required = false) String entryType,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String personToMeet,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String cardNumber,
            @RequestParam(required = false) String workstationMac,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String locationId,
            @RequestParam(required = false) Boolean allLocations,
            @RequestHeader(value = WorkstationMacUtil.HEADER_NAME, required = false) String callerWorkstationMac,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication auth) {

        StaffActivityFilterDto filters = StaffActivityFilterDto.builder()
                .staffQuery(q)
                .visitorName(visitorName)
                .contactQuery(contactQuery)
                .entryType(entryType)
                .department(department)
                .personToMeet(personToMeet)
                .status(status)
                .cardNumber(cardNumber)
                .workstationMac(workstationMac)
                .build();

        PagedResponseDto<ReportReceptionistEntryDto> data = reportService.getStaffActivity(
                auth.getName(), auth, callerWorkstationMac, filters, from, to,
                locationId, allLocations, page, size);
        return ResponseEntity.ok(ApiResponse.success("Staff activity retrieved.", data));
    }
}
