package com.medplus.frontdesk_backend.controller;

import com.medplus.frontdesk_backend.dto.*;
import com.medplus.frontdesk_backend.security.AuthorizationHelper;
import com.medplus.frontdesk_backend.service.CardService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST API for the Card Master feature.
 *
 * Endpoints:
 *   GET  /api/cards/stats               — stats per location (all roles)
 *   GET  /api/cards                     — paginated card list (all roles)
 *   PATCH /api/cards/{id}/restore       — restore MISSING card (admin)
 *   GET  /api/cards/requests            — list requests (all roles)
 *   POST /api/cards/requests            — submit request (all roles)
 *   PATCH /api/cards/requests/{id}/fulfill — fulfil request (admin)
 *   PATCH /api/cards/requests/{id}/cancel  — cancel request (all roles)
 */
@RestController
@RequestMapping("/api/cards")
@RequiredArgsConstructor
public class CardController {

    private final CardService         cardService;
    private final AuthorizationHelper authHelper;

    // ── GET /api/cards/stats ──────────────────────────────────────────────────
    // AUTO-SCOPED: RECEPTIONIST and REGIONAL_ADMIN always see only their location.

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<List<CardStatsDto>>> getStats(
            @RequestParam(required = false) String locationId,
            Authentication auth) {
        String effectiveLoc = authHelper.resolveEffectiveLocation(auth, locationId);
        return ResponseEntity.ok(
            ApiResponse.success("Card stats retrieved.", cardService.getStats(effectiveLoc)));
    }

    // ── GET /api/cards ────────────────────────────────────────────────────────
    // AUTO-SCOPED by role.

    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponseDto<CardDto>>> getCards(
            @RequestParam(required = false)        String locationId,
            @RequestParam(required = false)        String status,
            @RequestParam(defaultValue = "0")      int    page,
            @RequestParam(defaultValue = "50")     int    size,
            Authentication auth) {
        String effectiveLoc = authHelper.resolveEffectiveLocation(auth, locationId);
        return ResponseEntity.ok(
            ApiResponse.success("Cards retrieved.",
                cardService.getCards(effectiveLoc, status, page, size)));
    }

    // ── PATCH /api/cards/{id}/restore ─────────────────────────────────────────

    @PatchMapping("/{id}/restore")
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN','REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> restoreCard(@PathVariable long id) {
        cardService.restoreCard(id);
        return ResponseEntity.ok(ApiResponse.success("Card restored to AVAILABLE.", null));
    }

    // ── GET /api/cards/requests ───────────────────────────────────────────────
    // AUTO-SCOPED by role.

    @GetMapping("/requests")
    public ResponseEntity<ApiResponse<List<CardRequestDto>>> getRequests(
            @RequestParam(required = false) String locationId,
            @RequestParam(required = false) String status,
            Authentication auth) {
        String effectiveLoc = authHelper.resolveEffectiveLocation(auth, locationId);
        return ResponseEntity.ok(
            ApiResponse.success("Card requests retrieved.",
                cardService.getRequests(effectiveLoc, status)));
    }

    // ── POST /api/cards/requests ──────────────────────────────────────────────
    // RECEPTIONIST may only submit for their own location.

    @PostMapping("/requests")
    public ResponseEntity<ApiResponse<CardRequestDto>> submitRequest(
            @Valid @RequestBody CardRequestSubmitDto dto,
            Authentication auth) {
        // Enforce: non-admin callers can only submit for their own location
        if (!authHelper.isPrimaryAdmin(auth)) {
            authHelper.assertLocationAccess(auth, dto.getLocationId());
        }
        CardRequestDto created = cardService.submitRequest(dto, auth.getName());
        return ResponseEntity.ok(ApiResponse.success("Card request submitted.", created));
    }

    // ── PATCH /api/cards/requests/{id}/fulfill ────────────────────────────────
    // REGIONAL_ADMIN can fulfil requests for their own location only.

    @PatchMapping("/requests/{id}/fulfill")
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN','REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<CardRequestDto>> fulfillRequest(
            @PathVariable long id,
            Authentication auth) {
        CardRequestDto result = cardService.fulfillRequest(id, auth.getName(), authHelper, auth);
        return ResponseEntity.ok(ApiResponse.success("Request fulfilled — new cards generated.", result));
    }

    // ── PATCH /api/cards/requests/{id}/cancel ────────────────────────────────
    // Any role may cancel, but only for their own location.

    @PatchMapping("/requests/{id}/cancel")
    public ResponseEntity<ApiResponse<CardRequestDto>> cancelRequest(
            @PathVariable long id,
            Authentication auth) {
        CardRequestDto result = cardService.cancelRequest(id, auth.getName(), authHelper, auth);
        return ResponseEntity.ok(ApiResponse.success("Request cancelled.", result));
    }

    // ── GET /api/cards/requests/{id}/cards ────────────────────────────────────
    // Returns the list of card codes that belong to a specific request batch.

    @GetMapping("/requests/{id}/cards")
    public ResponseEntity<ApiResponse<List<String>>> getCardsForRequest(@PathVariable long id) {
        List<String> codes = cardService.getCardsForRequest(id);
        return ResponseEntity.ok(ApiResponse.success("Card codes retrieved.", codes));
    }

    // ── PATCH /api/cards/requests/{id}/mark-downloaded ────────────────────────
    // Called by the frontend after successfully generating + saving the PDF.

    @PatchMapping("/requests/{id}/mark-downloaded")
    public ResponseEntity<ApiResponse<Void>> markDownloaded(
            @PathVariable long id,
            Authentication auth) {
        cardService.markDownloaded(id);
        return ResponseEntity.ok(ApiResponse.success("Batch marked as downloaded.", null));
    }
}
