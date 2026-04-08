package com.medplus.frontdesk_backend.controller;

import com.medplus.frontdesk_backend.dto.ApiResponse;
import com.medplus.frontdesk_backend.dto.ReportAvgDurationDto;
import com.medplus.frontdesk_backend.dto.ReportDeptSummaryDto;
import com.medplus.frontdesk_backend.dto.ReportFrequentVisitorDto;
import com.medplus.frontdesk_backend.dto.ReportRatioDto;
import com.medplus.frontdesk_backend.service.ReportService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

/**
 * REST endpoints for the Reports page.
 *
 * All endpoints require authentication (covered by the global security filter).
 * Location scoping is applied automatically based on the caller's role:
 *  - RECEPTIONIST → their assigned location only
 *  - PRIMARY / REGIONAL ADMIN → all locations
 *
 * Base path: /api/reports
 */
@Slf4j
@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    /**
     * GET /api/reports/department-summary
     *
     * Returns visit counts grouped by department for the requested date range.
     * Used by the bar chart on the Reports page.
     *
     * Query params:
     *   from  – inclusive start date (YYYY-MM-DD)
     *   to    – inclusive end date   (YYYY-MM-DD)
     *
     * Response data: List&lt;{ department, visitCount }&gt; ordered by visitCount desc.
     */
    @GetMapping("/department-summary")
    public ResponseEntity<ApiResponse<List<ReportDeptSummaryDto>>> getDeptSummary(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String locationId,
            Authentication auth) {

        List<ReportDeptSummaryDto> data =
                reportService.getDeptSummary(auth.getName(), auth, from, to, locationId);
        return ResponseEntity.ok(ApiResponse.success("Department summary retrieved.", data));
    }

    /**
     * GET /api/reports/visitor-ratio
     *
     * Returns aggregate counts of visitor vs employee entries for the date range.
     * Used by the donut chart on the Reports page.
     *
     * Query params:
     *   from  – inclusive start date (YYYY-MM-DD)
     *   to    – inclusive end date   (YYYY-MM-DD)
     *
     * Response data: { visitorCount, employeeCount, totalCount }.
     */
    @GetMapping("/visitor-ratio")
    public ResponseEntity<ApiResponse<ReportRatioDto>> getVisitorRatio(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String locationId,
            Authentication auth) {

        ReportRatioDto data =
                reportService.getVisitorRatio(auth.getName(), auth, from, to, locationId);
        return ResponseEntity.ok(ApiResponse.success("Visitor ratio retrieved.", data));
    }

    /**
     * GET /api/reports/avg-duration
     *
     * Returns the average visit duration (minutes) per department for
     * check-outs that occurred within the date range.
     *
     * Query params:
     *   from  – inclusive start date (YYYY-MM-DD)
     *   to    – inclusive end date   (YYYY-MM-DD)
     *
     * Response data: List&lt;{ department, avgDurationMinutes, visitCount }&gt;
     *               ordered by avgDurationMinutes desc.
     */
    @GetMapping("/avg-duration")
    public ResponseEntity<ApiResponse<List<ReportAvgDurationDto>>> getAvgDuration(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String locationId,
            Authentication auth) {

        List<ReportAvgDurationDto> data =
                reportService.getAvgDuration(auth.getName(), auth, from, to, locationId);
        return ResponseEntity.ok(ApiResponse.success("Average duration retrieved.", data));
    }

    /**
     * GET /api/reports/frequent-visitors
     *
     * Returns external visitors (entryType = VISITOR) who have checked in
     * at least {@code minVisits} times within the date range.
     *
     * Query params:
     *   from      – inclusive start date (YYYY-MM-DD)
     *   to        – inclusive end date   (YYYY-MM-DD)
     *   minVisits – minimum check-in count to qualify (default: 2)
     *
     * Response data: List&lt;{ name, mobile, visitCount, lastVisit, departments }&gt;
     *               ordered by visitCount desc.
     */
    @GetMapping("/frequent-visitors")
    public ResponseEntity<ApiResponse<List<ReportFrequentVisitorDto>>> getFrequentVisitors(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "2") int minVisits,
            @RequestParam(required = false) String locationId,
            Authentication auth) {

        List<ReportFrequentVisitorDto> data =
                reportService.getFrequentVisitors(auth.getName(), auth, from, to, minVisits, locationId);
        return ResponseEntity.ok(ApiResponse.success("Frequent visitors retrieved.", data));
    }
}
