package com.medplus.frontdesk.backend.controller;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.medplus.frontdesk.backend.dto.visitor.CheckInGroupDto;
import com.medplus.frontdesk.backend.dto.visitor.CheckInVisitorDto;
import com.medplus.frontdesk.backend.dto.visitor.UpdateVisitorDto;
import com.medplus.frontdesk.backend.dto.visitor.VisitorDto;
import com.medplus.frontdesk.backend.dto.visitor.VisitorPageDto;
import com.medplus.frontdesk.backend.exceptions.VisitorNotFoundException;
import com.medplus.frontdesk.backend.service.VisitorService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * REST controller for visitor operations.
 *
 * All routes require USER role (receptionist), enforced by SecurityConfig.
 *
 *  POST /user/visitors/check-in              — single visitor check-in
 *  POST /user/visitors/group-check-in        — group check-in
 *  PUT  /user/visitors/{visitorId}           — edit global fields of a visitor
 *  POST /user/visitors/{visitorId}/checkout  — check out a visitor
 *  GET  /user/visitors                       — paginated list with search / filter
 */
@Validated
@RestController
@RequestMapping("/user/visitors")
@RequiredArgsConstructor
public class VisitorController {

    private final VisitorService visitorService;

    // ── POST /user/visitors/check-in ──────────────────────────────────────────

    /**
     * Checks in a single visitor. The visitor ID is auto-generated as
     * {@code MED-V-NNN} (e.g. {@code MED-V-001}).
     *
     * Returns {@code 201 Created} with the saved {@link VisitorDto}.
     */
    @PostMapping("/check-in")
    public ResponseEntity<VisitorDto> checkInSingle(
            @Valid @RequestBody CheckInVisitorDto dto,
            Authentication auth) {

        VisitorDto saved = visitorService.checkInSingle(auth.getName(), dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    // ── POST /user/visitors/group-check-in ────────────────────────────────────

    /**
     * Checks in a group of visitors. IDs are auto-generated as
     * {@code MED-GV-NNN} (e.g. {@code MED-GV-001} for the head).
     *
     * Returns {@code 201 Created} with the full list (head first, then members).
     */
    @PostMapping("/group-check-in")
    public ResponseEntity<List<VisitorDto>> checkInGroup(
            @Valid @RequestBody CheckInGroupDto dto,
            Authentication auth) {

        List<VisitorDto> saved = visitorService.checkInGroup(auth.getName(), dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    // ── PUT /user/visitors/{visitorId} ────────────────────────────────────────

    /**
     * Edits the global (editable) fields of an existing visitor:
     * visitorType, fullName, locationId, identificationNumber, govtId,
     * personToMeet, cardNumber.
     *
     * Returns {@code 200 OK} with the updated visitor, or {@code 404} if
     * the visitor ID does not exist.
     */
    @PutMapping("/{visitorId}")
    public ResponseEntity<?> updateVisitor(
            @PathVariable String visitorId,
            @Valid @RequestBody UpdateVisitorDto dto,
            Authentication auth) {

        try {
            VisitorDto updated = visitorService.updateVisitor(auth.getName(), visitorId, dto);
            return ResponseEntity.ok(updated);
        } catch (VisitorNotFoundException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorBody(ex.getMessage()));
        }
    }

    // ── POST /user/visitors/{visitorId}/checkout ──────────────────────────────

    /**
     * Checks out a currently checked-in visitor.
     *
     * Returns {@code 200 OK} with the updated visitor record (status = CheckedOut,
     * checkOutTime stamped), {@code 404} if the visitor does not exist, or
     * {@code 409 Conflict} if the visitor is already checked out.
     */
    @PostMapping("/{visitorId}/checkout")
    public ResponseEntity<?> checkOut(
            @PathVariable String visitorId,
            Authentication auth) {

        try {
            VisitorDto updated = visitorService.checkOut(auth.getName(), visitorId);
            return ResponseEntity.ok(updated);
        } catch (VisitorNotFoundException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorBody(ex.getMessage()));
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(new ErrorBody(ex.getMessage()));
        }
    }

    // ── GET /user/visitors ────────────────────────────────────────────────────

    /**
     * Returns a paginated list of visitors with optional search and filters.
     *
     * Query parameters:
     * <ul>
     *   <li>{@code search}     — substring matched on fullName, identificationNumber,
     *                            govtId, cardNumber, personToMeet</li>
     *   <li>{@code status}     — {@code CheckedIn} | {@code CheckedOut} | {@code ALL} (default)</li>
     *   <li>{@code locationId} — filter by a specific location</li>
     *   <li>{@code fromDate}   — inclusive start date (YYYY-MM-DD); defaults to today</li>
     *   <li>{@code toDate}     — inclusive end date (YYYY-MM-DD); defaults to today</li>
     *   <li>{@code page}       — 0-based page index (default: 0)</li>
     *   <li>{@code pageSize}   — rows per page (default: 10, max: 100)</li>
     * </ul>
     */
    @GetMapping
    public ResponseEntity<VisitorPageDto> getVisitors(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "ALL") String status,
            @RequestParam(required = false) String locationId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int pageSize) {

        VisitorPageDto result = visitorService.getVisitors(
                search, status, locationId, fromDate, toDate, page, pageSize);
        return ResponseEntity.ok(result);
    }

    // ── Inner helper ──────────────────────────────────────────────────────────

    record ErrorBody(String message) {}
}
