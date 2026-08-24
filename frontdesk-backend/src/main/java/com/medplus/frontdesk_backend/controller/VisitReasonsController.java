package com.medplus.frontdesk_backend.controller;

import com.medplus.frontdesk_backend.dto.ApiResponse;
import com.medplus.frontdesk_backend.dto.CreateVisitReasonRequestDto;
import com.medplus.frontdesk_backend.dto.MasterStatusRequestDto;
import com.medplus.frontdesk_backend.dto.PagedResponseDto;
import com.medplus.frontdesk_backend.dto.UpdateVisitReasonRequestDto;
import com.medplus.frontdesk_backend.dto.VisitReasonDto;
import com.medplus.frontdesk_backend.model.VisitReasonType;
import com.medplus.frontdesk_backend.service.VisitReasonService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST controller for managing visit reasons (visitor & employee).
 *
 * Admin UI (PRIMARY_ADMIN / REGIONAL_ADMIN): full CRUD via paginated endpoints.
 * Dropdown consumers (all authenticated clients): GET /active for readonly list.
 */
@RestController
@RequestMapping("/api/visit-reasons")
@RequiredArgsConstructor
public class VisitReasonsController {

    private final VisitReasonService visitReasonService;

    /**
     * GET /api/visit-reasons/active?type=VISITOR
     * Returns all active reasons for a given type. Used by check-in modals and self-registration.
     * Open to all authenticated users.
     */
    @GetMapping("/active")
    public ResponseEntity<ApiResponse<List<VisitReasonDto>>> getActiveReasons(
            @RequestParam VisitReasonType type) {
        List<VisitReasonDto> reasons = visitReasonService.getActiveByType(type);
        return ResponseEntity.ok(ApiResponse.success("Active visit reasons retrieved.", reasons));
    }

    /**
     * GET /api/visit-reasons?type=VISITOR&page=0&size=20
     * Paginated list for admin UI. Supports type and status filter.
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN', 'REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<PagedResponseDto<VisitReasonDto>>> listReasons(
            @RequestParam VisitReasonType type,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success("Visit reasons retrieved.",
                visitReasonService.list(type, status, page, size)));
    }

    /**
     * POST /api/visit-reasons
     * Create a new visit reason.
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN', 'REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<VisitReasonDto>> createReason(
            @Valid @RequestBody CreateVisitReasonRequestDto body,
            Authentication auth) {
        VisitReasonDto created = visitReasonService.create(body, auth.getName());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Visit reason created.", created));
    }

    /**
     * PUT /api/visit-reasons/{id}
     * Update the reason name.
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN', 'REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<VisitReasonDto>> updateReason(
            @PathVariable long id,
            @Valid @RequestBody UpdateVisitReasonRequestDto body,
            Authentication auth) {
        VisitReasonDto updated = visitReasonService.updateName(id, body.getReasonName(), auth.getName());
        return ResponseEntity.ok(ApiResponse.success("Visit reason updated.", updated));
    }

    /**
     * PATCH /api/visit-reasons/{id}/status
     * Toggle active/inactive status.
     */
    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN', 'REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<VisitReasonDto>> toggleStatus(
            @PathVariable long id,
            @Valid @RequestBody MasterStatusRequestDto body,
            Authentication auth) {
        VisitReasonDto updated = visitReasonService.toggleStatus(id, body.getActive(), auth.getName());
        return ResponseEntity.ok(ApiResponse.success("Visit reason status updated.", updated));
    }

    /**
     * DELETE /api/visit-reasons/{id}
     * Delete a visit reason.
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN', 'REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteReason(@PathVariable long id) {
        visitReasonService.delete(id);
        return ResponseEntity.ok(ApiResponse.success("Visit reason deleted.", null));
    }
}
