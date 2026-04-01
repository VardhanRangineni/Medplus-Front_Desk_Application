package com.medplus.frontdesk_backend.controller;

import com.medplus.frontdesk_backend.dto.ApiResponse;
import com.medplus.frontdesk_backend.dto.EmployeeLookupResponseDto;
import com.medplus.frontdesk_backend.dto.PagedResponseDto;
import com.medplus.frontdesk_backend.dto.PersonToMeetDto;
import com.medplus.frontdesk_backend.dto.StatusCountsDto;
import com.medplus.frontdesk_backend.dto.VisitorMemberDto;
import com.medplus.frontdesk_backend.dto.VisitorRequestDto;
import com.medplus.frontdesk_backend.dto.VisitorResponseDto;
import com.medplus.frontdesk_backend.service.VisitorService;
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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/visitors")
@RequiredArgsConstructor
public class VisitorController {

    private final VisitorService visitorService;

    // ── POST /api/visitors ────────────────────────────────────────────────────

    /**
     * Creates a new check-in entry (visitor or employee).
     *
     * Request body example — individual visitor:
     * {
     *   "visitType":      "INDIVIDUAL",
     *   "entryType":      "VISITOR",
     *   "name":           "Prabhas",
     *   "mobile":         "9000000001",
     *   "personToMeetId": "EMP-001",
     *   "cardNumber":     77,
     *   "reasonForVisit": "Business meeting"
     * }
     *
     * Request body example — group visitor:
     * {
     *   "visitType":      "GROUP",
     *   "entryType":      "VISITOR",
     *   "name":           "Rohit",
     *   "mobile":         "9000000002",
     *   "personToMeetId": "EMP-002",
     *   "cardNumber":     44,
     *   "members": [
     *     { "name": "Virat Kohli",  "cardNumber": 45 },
     *     { "name": "Rohit Sharma", "cardNumber": 46 }
     *   ]
     * }
     */
    @PostMapping
    public ResponseEntity<ApiResponse<VisitorResponseDto>> checkIn(
            @Valid @RequestBody VisitorRequestDto request,
            Authentication auth) {

        String caller = auth.getName();
        VisitorResponseDto created = visitorService.checkIn(request, caller);
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success("Check-in successful.", created));
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
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) String locationId,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication auth) {

        PagedResponseDto<VisitorResponseDto> result =
                visitorService.getEntries(auth.getName(), date, locationId, department, status, page, size, auth);
        return ResponseEntity.ok(ApiResponse.success("Entries retrieved successfully.", result));
    }

    // ── GET /api/visitors/{visitorId} ─────────────────────────────────────────

    /**
     * Returns the full details of a single visitor entry by ID.
     * Used by the Edit Visitor / Edit Employee modals to pre-fill their forms.
     *
     * Path param:
     *   visitorId — e.g. "MED-V-0001" or "MED-GV-0001"
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
            Authentication auth) {

        List<VisitorResponseDto> entries = visitorService.getRecentEntries(auth.getName(), auth);
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
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) String locationId,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication auth) {

        PagedResponseDto<VisitorResponseDto> results =
                visitorService.searchEntries(auth.getName(), date, q, locationId, department, status, page, size, auth);
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
            Authentication auth) {

        StatusCountsDto counts =
                visitorService.getStatusCounts(auth.getName(), locationId, auth);
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
            Authentication auth) {

        List<String> depts =
                visitorService.getDepartmentsInLog(auth.getName(), date, locationId, auth);
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
            @RequestParam(required = false) String department,
            Authentication auth) {

        byte[] csv = visitorService.exportCsv(auth.getName(), date, locationId, department, auth);
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
            Authentication auth) {

        VisitorResponseDto updated = visitorService.updateEntry(visitorId, request, auth.getName());
        return ResponseEntity.ok(ApiResponse.success("Entry updated successfully.", updated));
    }

    // ── PATCH /api/visitors/{visitorId}/checkout ──────────────────────────────

    /**
     * Checks out the primary visitor / employee entry.
     */
    @PatchMapping("/{visitorId}/checkout")
    public ResponseEntity<ApiResponse<VisitorResponseDto>> checkOut(
            @PathVariable String visitorId,
            Authentication auth) {

        VisitorResponseDto result = visitorService.checkOut(visitorId, auth.getName());
        return ResponseEntity.ok(ApiResponse.success("Checked out successfully.", result));
    }

    // ── PATCH /api/visitors/{visitorId}/members/{memberId}/checkout ───────────

    /**
     * Checks out a single member within a group visit entry.
     */
    @PatchMapping("/{visitorId}/members/{memberId}/checkout")
    public ResponseEntity<ApiResponse<VisitorMemberDto>> checkOutMember(
            @PathVariable String visitorId,
            @PathVariable String memberId,
            Authentication auth) {

        VisitorMemberDto result = visitorService.checkOutMember(visitorId, memberId, auth.getName());
        return ResponseEntity.ok(ApiResponse.success("Member checked out successfully.", result));
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
            Authentication auth) {

        List<PersonToMeetDto> results = visitorService.searchPersonsToMeet(auth.getName(), q);
        return ResponseEntity.ok(ApiResponse.success("Person search results.", results));
    }

    // ── GET /api/visitors/persons-at-location ─────────────────────────────────

    /**
     * Returns the full list of employees at the caller's location.
     * Used to populate the "Person to Meet" dropdown on modal open.
     */
    @GetMapping("/persons-at-location")
    public ResponseEntity<ApiResponse<List<PersonToMeetDto>>> getPersonsAtLocation(
            Authentication auth) {

        List<PersonToMeetDto> results = visitorService.getPersonsAtLocation(auth.getName());
        return ResponseEntity.ok(ApiResponse.success("Persons at location.", results));
    }

    // ── GET /api/visitors/departments ────────────────────────────────────────

    /**
     * Returns distinct department names at the caller's location.
     * Used to populate the "Host Department" dropdown on check-in modals.
     * Response: ["Operations", "HR", "IT", ...]
     */
    @GetMapping("/departments")
    public ResponseEntity<ApiResponse<List<String>>> getDepartments(Authentication auth) {
        List<String> depts = visitorService.getDepartmentsAtLocation(auth.getName());
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
