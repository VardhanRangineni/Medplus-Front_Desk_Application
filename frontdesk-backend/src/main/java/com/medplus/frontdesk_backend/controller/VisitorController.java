package com.medplus.frontdesk_backend.controller;

import com.medplus.frontdesk_backend.dto.ApiResponse;
import com.medplus.frontdesk_backend.dto.PersonToMeetDto;
import com.medplus.frontdesk_backend.dto.VisitorMemberDto;
import com.medplus.frontdesk_backend.dto.VisitorRequestDto;
import com.medplus.frontdesk_backend.dto.VisitorResponseDto;
import com.medplus.frontdesk_backend.service.VisitorService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
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
     * Returns all check-in/check-out entries for the caller's location on the given date.
     * Defaults to today if the date parameter is omitted.
     *
     * Query params:
     *   date (optional) — ISO date, e.g. 2026-03-28
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<VisitorResponseDto>>> getEntries(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            Authentication auth) {

        List<VisitorResponseDto> entries = visitorService.getEntries(auth.getName(), date);
        return ResponseEntity.ok(ApiResponse.success("Entries retrieved successfully.", entries));
    }

    // ── GET /api/visitors/search ──────────────────────────────────────────────

    /**
     * Full-text search within the caller's location + date.
     * Searches visitor name, mobile, empId, and person-to-meet name.
     *
     * Query params:
     *   q    — search term
     *   date — ISO date (optional, defaults to today)
     */
    @GetMapping("/search")
    public ResponseEntity<ApiResponse<List<VisitorResponseDto>>> searchEntries(
            @RequestParam(defaultValue = "") String q,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            Authentication auth) {

        List<VisitorResponseDto> results = visitorService.searchEntries(auth.getName(), date, q);
        return ResponseEntity.ok(ApiResponse.success("Search results.", results));
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
     * Only returns employees working at the same location as the receptionist.
     *
     * Query params:
     *   q — search term (min 1 char; empty → [])
     */
    @GetMapping("/person-search")
    public ResponseEntity<ApiResponse<List<PersonToMeetDto>>> searchPersonsToMeet(
            @RequestParam(defaultValue = "") String q,
            Authentication auth) {

        List<PersonToMeetDto> results = visitorService.searchPersonsToMeet(auth.getName(), q);
        return ResponseEntity.ok(ApiResponse.success("Person search results.", results));
    }
}
