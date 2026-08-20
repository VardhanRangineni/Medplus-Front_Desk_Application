package com.medplus.frontdesk_backend.controller;

import com.medplus.frontdesk_backend.dto.ApiResponse;
import com.medplus.frontdesk_backend.dto.EmployeeLookupResponseDto;
import com.medplus.frontdesk_backend.dto.GroupVisitorRequestDto;
import com.medplus.frontdesk_backend.dto.GroupVisitorResponseDto;
import com.medplus.frontdesk_backend.dto.PagedResponseDto;
import com.medplus.frontdesk_backend.dto.PersonToMeetDto;
import com.medplus.frontdesk_backend.dto.StatusCountsDto;
import com.medplus.frontdesk_backend.dto.VisitorMovementEventDto;
import com.medplus.frontdesk_backend.dto.VisitorRequestDto;
import com.medplus.frontdesk_backend.dto.VisitorResponseDto;
import com.medplus.frontdesk_backend.dto.VisitorScanRequestDto;
import com.medplus.frontdesk_backend.dto.VisitorScanResponseDto;
import com.medplus.frontdesk_backend.service.VisitorScanService;
import com.medplus.frontdesk_backend.service.VisitorService;
import com.medplus.frontdesk_backend.util.WorkstationMacUtil;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/visitors")
@RequiredArgsConstructor
public class VisitorController {

    private final VisitorService visitorService;
    private final VisitorScanService visitorScanService;

    // ── POST /api/visitors ────────────────────────────────────────────────────

    /**
     * Creates a new check-in entry (visitor or employee).
     *
     * Request body example:
     * {
     *   "entryType":      "VISITOR",
     *   "name":           "Prabhas",
     *   "mobile":         "9000000001",
     *   "personToMeetId": "EMP-001",
     *   "cardNumber":     77,
     *   "reasonForVisit": "Business meeting"
     * }
     */
    @PostMapping
    public ResponseEntity<ApiResponse<VisitorResponseDto>> checkIn(
            @Valid @RequestBody VisitorRequestDto request,
            @RequestHeader(value = WorkstationMacUtil.HEADER_NAME, required = false) String workstationMac,
            Authentication auth) {

        String caller = auth.getName();
        VisitorResponseDto created = visitorService.checkIn(request, caller, workstationMac);
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success("Check-in successful.", created));
    }

    // ── POST /api/visitors/group ──────────────────────────────────────────────

    /**
     * Creates a group visit: one MED-GROUP-#### and N MED-GV-#### member rows.
     */
    @PostMapping("/group")
    public ResponseEntity<ApiResponse<GroupVisitorResponseDto>> checkInGroup(
            @Valid @RequestBody GroupVisitorRequestDto request,
            @RequestHeader(value = WorkstationMacUtil.HEADER_NAME, required = false) String workstationMac,
            Authentication auth) {

        String caller = auth.getName();
        GroupVisitorResponseDto created = visitorService.checkInGroup(request, caller, workstationMac);
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success("Group check-in successful.", created));
    }

    // ── POST /api/visitors/scan ───────────────────────────────────────────────

    /**
     * Records a zone movement scan for a checked-in visitor (floor kiosk / corridor scanner).
     * QR payload: PREREG:token, VISITOR:MED-V-0001, or MED-V-0001.
     */
    @PostMapping("/scan")
    public ResponseEntity<ApiResponse<VisitorScanResponseDto>> recordZoneScan(
            @Valid @RequestBody VisitorScanRequestDto request,
            @RequestHeader(value = WorkstationMacUtil.HEADER_NAME, required = false) String workstationMac,
            Authentication auth) {

        VisitorScanResponseDto result = visitorScanService.recordZoneScan(
                request.getPayload(), auth.getName(), workstationMac);
        return ResponseEntity.ok(ApiResponse.success(result.getMessage(), result));
    }

    // ── POST /api/visitors/{id}/resend-visit-pass ─────────────────────────────

    @PostMapping("/{id}/resend-visit-pass")
    public ResponseEntity<ApiResponse<Map<String, Object>>> resendVisitPass(@PathVariable String id) {
        boolean sent = visitorService.resendVisitPass(id);
        if (!sent) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Could not resend visit pass. Check mobile number and try again."));
        }
        return ResponseEntity.ok(ApiResponse.success("Visit pass resend queued.", Map.of("sent", true)));
    }

    // ── GET /api/visitors ─────────────────────────────────────────────────────

    /**
     * Returns a paginated page of check-in/check-out entries.
     *
     * Query params:
     *   date       (optional) — ISO date, e.g. 2026-03-28.
     *                           When omitted, entries across ALL dates are returned.
     *   locationId (optional) — restrict to a specific location (admin-level override).
     *                           Receptionists always see their own location.
     *                           If omitted by an admin, all locations are returned.
     *   department (optional) — filter entries by the host department name.
     *   status     (optional) — "checked-in" or "checked-out"; omit for all entries.
     *   page       (optional) — 0-based page index (default 0).
     *   size       (optional) — records per page (default 20).
     *
     * Response body (data field):
     * {
     *   "content":       [...],
     *   "page":          0,
     *   "size":          20,
     *   "totalElements": 143,
     *   "totalPages":    8,
     *   "first":         true,
     *   "last":          false
     * }
     */
    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponseDto<VisitorResponseDto>>> getEntries(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String locationId,
            @RequestParam(required = false) Boolean allLocations,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String createdBy,
            @RequestParam(required = false) String entryType,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String contactQuery,
            @RequestParam(required = false) String personToMeet,
            @RequestParam(required = false) String cardNumber,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestHeader(value = WorkstationMacUtil.HEADER_NAME, required = false) String workstationMac,
            Authentication auth) {

        PagedResponseDto<VisitorResponseDto> result =
                visitorService.getEntries(auth.getName(), from, to, locationId, allLocations, department, status,
                        createdBy, entryType, name, contactQuery, personToMeet, cardNumber,
                        page, size, workstationMac, auth);
        return ResponseEntity.ok(ApiResponse.success("Entries retrieved successfully.", result));
    }

    // ── GET /api/visitors/{visitorId}/movement ────────────────────────────────

    /**
     * Ordered movement trail: check-in, zone scans, and check-out for one entry.
     */
    @GetMapping("/{visitorId}/movement")
    public ResponseEntity<ApiResponse<List<VisitorMovementEventDto>>> getMovementTrail(
            @PathVariable String visitorId) {
        List<VisitorMovementEventDto> trail = visitorService.getMovementTrail(visitorId);
        return ResponseEntity.ok(ApiResponse.success("Movement trail retrieved.", trail));
    }

    // ── GET /api/visitors/{visitorId} ─────────────────────────────────────────

    /**
     * Returns the full details of a single visitor entry by ID.
     * Used by the Edit Visitor / Edit Employee modals to pre-fill their forms.
     *
     * Path param:
     *   visitorId — e.g. "MED-V-0001"
     */
    @GetMapping("/{visitorId}")
    public ResponseEntity<ApiResponse<VisitorResponseDto>> getEntryById(
            @PathVariable String visitorId) {

        VisitorResponseDto entry = visitorService.getEntryById(visitorId);
        return ResponseEntity.ok(ApiResponse.success("Entry retrieved.", entry));
    }

    // ── GET /api/visitors/recent ──────────────────────────────────────────────

    /**
     * Returns the 20 most recent visitor/employee entries for the caller's location.
     * Admins with no location filter see the 20 most recent entries across all locations.
     * Used by the Dashboard "Recent Visitors" widget.
     */
    @GetMapping("/recent")
    public ResponseEntity<ApiResponse<List<VisitorResponseDto>>> getRecentEntries(
            @RequestParam(required = false) String locationId,
            @RequestParam(required = false) Boolean allLocations,
            @RequestHeader(value = WorkstationMacUtil.HEADER_NAME, required = false) String workstationMac,
            Authentication auth) {

        List<VisitorResponseDto> entries = visitorService.getRecentEntries(
                auth.getName(), workstationMac, locationId, allLocations, auth);
        return ResponseEntity.ok(ApiResponse.success("Recent entries retrieved.", entries));
    }

    // ── GET /api/visitors/search ──────────────────────────────────────────────

    /**
     * Full-text paginated search within entries (scoped by role/location).
     * Searches visitor name, mobile, empId, and person-to-meet name.
     *
     * Query params:
     *   q          — search term
     *   date       — ISO date (optional; omit for all dates)
     *   locationId — admin-level location override (optional)
     *   department — department filter (optional)
     *   status     — "checked-in" or "checked-out" (optional)
     *   page       — 0-based page index (default 0)
     *   size       — records per page (default 20)
     */
    @GetMapping("/search")
    public ResponseEntity<ApiResponse<PagedResponseDto<VisitorResponseDto>>> searchEntries(
            @RequestParam(defaultValue = "") String q,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String locationId,
            @RequestParam(required = false) Boolean allLocations,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String createdBy,
            @RequestParam(required = false) String entryType,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String contactQuery,
            @RequestParam(required = false) String personToMeet,
            @RequestParam(required = false) String cardNumber,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestHeader(value = WorkstationMacUtil.HEADER_NAME, required = false) String workstationMac,
            Authentication auth) {

        PagedResponseDto<VisitorResponseDto> results =
                visitorService.searchEntries(auth.getName(), from, to, q, locationId, allLocations, department, status,
                        createdBy, entryType, name, contactQuery, personToMeet, cardNumber,
                        page, size, workstationMac, auth);
        return ResponseEntity.ok(ApiResponse.success("Search results.", results));
    }

    // ── GET /api/visitors/status-counts ──────────────────────────────────────

    /**
     * Returns aggregate counts grouped by visit status for the caller's scope.
     * Used to populate the All / Checked-in / Checked-out tab badges.
     *
     * Response body (data field):
     * { "total": 234, "checkedIn": 45, "checkedOut": 189 }
     */
    @GetMapping("/status-counts")
    public ResponseEntity<ApiResponse<StatusCountsDto>> getStatusCounts(
            @RequestParam(required = false) String locationId,
            @RequestParam(required = false) Boolean allLocations,
            @RequestHeader(value = WorkstationMacUtil.HEADER_NAME, required = false) String workstationMac,
            Authentication auth) {

        StatusCountsDto counts =
                visitorService.getStatusCounts(auth.getName(), locationId, allLocations, workstationMac, auth);
        return ResponseEntity.ok(ApiResponse.success("Status counts.", counts));
    }

    // ── GET /api/visitors/log-departments ────────────────────────────────────

    /**
     * Returns distinct department names that actually appear in the visitor log for the
     * given date (and optional location). Used to build the "Filter by Dept" dropdown
     * dynamically from real data rather than a hardcoded list.
     *
     * Query params:
     *   date       — ISO date (optional, defaults to today)
     *   locationId — admin-level location override (optional)
     */
    @GetMapping("/log-departments")
    public ResponseEntity<ApiResponse<List<String>>> getDepartmentsInLog(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) String locationId,
            @RequestParam(required = false) Boolean allLocations,
            @RequestHeader(value = WorkstationMacUtil.HEADER_NAME, required = false) String workstationMac,
            Authentication auth) {

        List<String> depts =
                visitorService.getDepartmentsInLog(auth.getName(), date, locationId, allLocations, workstationMac, auth);
        return ResponseEntity.ok(ApiResponse.success("Log departments.", depts));
    }

    // ── GET /api/visitors/export ──────────────────────────────────────────────

    /**
     * Exports visitor entries for the given date/filters as a UTF-8 CSV file.
     * Applies the same admin/location/department rules as GET /api/visitors.
     *
     * Query params:
     *   date       — ISO date (optional, defaults to today)
     *   locationId — admin-level location override (optional)
     *   department — department filter (optional)
     *
     * Response: text/csv  attachment  visitors_YYYY-MM-DD.csv
     */
    @GetMapping("/export")
    public ResponseEntity<byte[]> exportCsv(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) String locationId,
            @RequestParam(required = false) Boolean allLocations,
            @RequestParam(required = false) String department,
            @RequestHeader(value = WorkstationMacUtil.HEADER_NAME, required = false) String workstationMac,
            Authentication auth) {

        byte[] csv = visitorService.exportCsv(
                auth.getName(), date, locationId, allLocations, department, workstationMac, auth);
        LocalDate queryDate = date != null ? date : LocalDate.now();
        String filename = "visitors_" + queryDate.format(DateTimeFormatter.ISO_LOCAL_DATE) + ".csv";

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .body(csv);
    }

    // ── PUT /api/visitors/{visitorId} ─────────────────────────────────────────

    /**
     * Updates an existing entry (name, contact, person-to-meet, card, reason).
     * Does NOT change status — use the checkout endpoints for that.
     */
    @PutMapping("/{visitorId}")
    public ResponseEntity<ApiResponse<VisitorResponseDto>> updateEntry(
            @PathVariable String visitorId,
            @Valid @RequestBody VisitorRequestDto request,
            @RequestHeader(value = WorkstationMacUtil.HEADER_NAME, required = false) String workstationMac,
            Authentication auth) {

        VisitorResponseDto updated = visitorService.updateEntry(
                visitorId, request, auth.getName(), workstationMac, auth);
        return ResponseEntity.ok(ApiResponse.success("Entry updated successfully.", updated));
    }

    // ── PATCH /api/visitors/{visitorId}/checkout ──────────────────────────────

    /**
     * Checks out the primary visitor / employee entry.
     */
    @PatchMapping("/{visitorId}/checkout")
    public ResponseEntity<ApiResponse<VisitorResponseDto>> checkOut(
            @PathVariable String visitorId,
            @RequestBody(required = false) java.util.Map<String, Object> body,
            @RequestHeader(value = WorkstationMacUtil.HEADER_NAME, required = false) String workstationMac,
            Authentication auth) {

        VisitorResponseDto result = visitorService.checkOut(
                visitorId, auth.getName(), workstationMac, auth);
        return ResponseEntity.ok(ApiResponse.success("Checked out successfully.", result));
    }

    // ── GET /api/visitors/person-search ──────────────────────────────────────

    /**
     * Type-ahead search for "person to meet" at the caller's location.
     * Searches by employee name, employee ID, or phone number.
     * Returns all employees at the location when q is omitted.
     */
    @GetMapping("/person-search")
    public ResponseEntity<ApiResponse<List<PersonToMeetDto>>> searchPersonsToMeet(
            @RequestParam(defaultValue = "") String q,
            @RequestHeader(value = WorkstationMacUtil.HEADER_NAME, required = false) String workstationMac,
            Authentication auth) {

        List<PersonToMeetDto> results = visitorService.searchPersonsToMeet(
                auth.getName(), q, workstationMac);
        return ResponseEntity.ok(ApiResponse.success("Person search results.", results));
    }

    // ── GET /api/visitors/person-by-mobile ────────────────────────────────────

    /**
     * Looks up person-to-meet by mobile number via HRMS.
     */
    @GetMapping("/person-by-mobile")
    public ResponseEntity<ApiResponse<PersonToMeetDto>> lookupPersonByMobile(
            @RequestParam String mobile,
            Authentication auth) {
        if (mobile == null || mobile.replaceAll("\\D", "").length() < 10) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("A valid 10-digit mobile number is required."));
        }
        try {
            PersonToMeetDto result = visitorService.lookupPersonToMeetByMobile(mobile, auth.getName());
            return ResponseEntity.ok(ApiResponse.success("Person found.", result));
        } catch (org.springframework.web.server.ResponseStatusException ex) {
            return ResponseEntity.status(ex.getStatusCode())
                    .body(ApiResponse.error(ex.getReason()));
        }
    }

    // ── GET /api/visitors/persons-at-location ─────────────────────────────────

    /**
     * Returns the full list of employees at the caller's location.
     * Used to populate the "Person to Meet" dropdown on modal open.
     */
    @GetMapping("/persons-at-location")
    public ResponseEntity<ApiResponse<List<PersonToMeetDto>>> getPersonsAtLocation(
            @RequestHeader(value = WorkstationMacUtil.HEADER_NAME, required = false) String workstationMac,
            Authentication auth) {

        List<PersonToMeetDto> results = visitorService.getPersonsAtLocation(
                auth.getName(), workstationMac);
        return ResponseEntity.ok(ApiResponse.success("Persons at location.", results));
    }

    // ── GET /api/visitors/departments ────────────────────────────────────────

    /**
     * Returns distinct department names at the caller's location.
     * Used to populate the "Host Department" dropdown on check-in modals.
     * Response: ["Operations", "HR", "IT", ...]
     */
    @GetMapping("/departments")
    public ResponseEntity<ApiResponse<List<String>>> getDepartments(
            @RequestHeader(value = WorkstationMacUtil.HEADER_NAME, required = false) String workstationMac,
            Authentication auth) {
        List<String> depts = visitorService.getDepartmentsAtLocation(auth.getName(), workstationMac);
        return ResponseEntity.ok(ApiResponse.success("Departments.", depts));
    }

    // ── GET /api/visitors/employee-lookup/{empId} ─────────────────────────────

    /**
     * Looks up an employee by their Employee ID.
     * Returns their name, department, and masked phone number (for OTP hint).
     *
     * Response when found:
     * { "found": true, "employee": { "id", "name", "department", "maskedPhone" } }
     *
     * Response when not found:
     * { "found": false, "message": "Employee ID not found..." }
     */
    @GetMapping("/employee-lookup/{empId}")
    public ResponseEntity<ApiResponse<EmployeeLookupResponseDto>> lookupEmployee(
            @PathVariable String empId) {

        EmployeeLookupResponseDto result = visitorService.lookupEmployee(empId);
        String msg = result.isFound() ? "Employee found." : result.getMessage();
        return ResponseEntity.ok(ApiResponse.success(msg, result));
    }
}
