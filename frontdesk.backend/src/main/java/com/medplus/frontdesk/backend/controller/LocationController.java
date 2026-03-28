package com.medplus.frontdesk.backend.controller;

import java.io.IOException;

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
import org.springframework.web.multipart.MultipartFile;

import com.medplus.frontdesk.backend.dto.location.BulkUploadResultDto;
import com.medplus.frontdesk.backend.dto.location.CreateLocationDto;
import com.medplus.frontdesk.backend.dto.location.LocationDto;
import com.medplus.frontdesk.backend.dto.location.LocationPageDto;
import com.medplus.frontdesk.backend.dto.location.UpdateLocationDto;
import com.medplus.frontdesk.backend.exceptions.LocationNotFoundException;
import com.medplus.frontdesk.backend.service.LocationService;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * REST controller for location management.
 *
 * All routes require ADMIN role (enforced by SecurityConfig).
 *
 *  GET  /admin/locations                  — paginated + searchable list
 *  POST /admin/locations                  — add a single location
 *  PUT  /admin/locations/{locationId}     — edit an existing location
 *  POST /admin/locations/bulk-upload      — import locations from .xlsx
 *  GET  /admin/locations/download-report  — export all locations as .xlsx
 */
@Slf4j
@Validated
@RestController
@RequestMapping("/admin/locations")
@RequiredArgsConstructor
public class LocationController {

    private final LocationService locationService;

    // ── GET /admin/locations ──────────────────────────────────────────────────
    /**
     * Fetch all locations with optional search + status filter and pagination.
     *
     * @param search   substring matched on name / id / city / state
     * @param status   ALL | CONFIGURED | NOTCONFIGURED  (default: ALL)
     * @param page     0-based page index (default: 0)
     * @param pageSize rows per page (default: 10, max: 100)
     */
    @GetMapping
    public ResponseEntity<LocationPageDto> getLocations(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "ALL") String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int pageSize) {

        LocationPageDto result = locationService.getLocations(search, status, page, pageSize);
        return ResponseEntity.ok(result);
    }

    // ── POST /admin/locations ─────────────────────────────────────────────────
    /**
     * Add a single new location.
     * Returns 201 Created with the saved location, or 409 Conflict if the
     * locationId is already taken.
     */
    @PostMapping
    public ResponseEntity<?> addLocation(
            @Valid @RequestBody CreateLocationDto dto,
            Authentication auth) {

        LocationDto saved = locationService.addLocation(auth.getName(), dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    // ── PUT /admin/locations/{locationId} ────────────────────────────────────
    /**
     * Edit an existing location.
     * The locationId (primary key) is supplied in the URL and cannot be changed.
     * Returns 200 OK with the updated location, or 404 if the ID does not exist.
     */
    @PutMapping("/{locationId}")
    public ResponseEntity<?> updateLocation(
            @PathVariable String locationId,
            @Valid @RequestBody UpdateLocationDto dto,
            Authentication auth) {

        try {
            LocationDto updated = locationService.updateLocation(locationId, auth.getName(), dto);
            return ResponseEntity.ok(updated);
        } catch (LocationNotFoundException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorBody(ex.getMessage()));
        }
    }

    // ── POST /admin/locations/bulk-upload ─────────────────────────────────────
    /**
     * Import locations from an Excel (.xlsx) file.
     *
     * Expected template (row 1 = header, row 2+ = data) — Location ID is auto-generated:
     *   A: Descriptive Name | B: Type | C: Coordinates (optional)
     *   D: Address | E: City | F: State | G: Pincode | H: Status (CONFIGURED|NOTCONFIGURED)
     *
     * Returns a {@link BulkUploadResultDto} summarising how many rows
     * succeeded / failed and the per-row error messages.
     */
    @PostMapping(value = "/bulk-upload", consumes = "multipart/form-data")
    public ResponseEntity<?> bulkUpload(
            @RequestParam("file") MultipartFile file,
            Authentication auth) {

        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(new ErrorBody("No file provided."));
        }

        String contentType = file.getContentType();
        if (contentType == null
                || (!contentType.contains("spreadsheetml")
                    && !contentType.contains("excel")
                    && !contentType.equals("application/octet-stream"))) {
            return ResponseEntity.badRequest()
                    .body(new ErrorBody("Only .xlsx files are accepted."));
        }

        try {
            BulkUploadResultDto result = locationService.bulkUpload(auth.getName(), file);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(new ErrorBody(ex.getMessage()));
        } catch (IOException ex) {
            log.error("Bulk upload I/O error", ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorBody("Failed to read the uploaded file."));
        }
    }

    // ── GET /admin/locations/download-report ──────────────────────────────────
    /**
     * Stream all locations as a downloadable .xlsx report.
     * Content-Disposition header triggers a file download in the browser.
     */
    @GetMapping("/download-report")
    public void downloadReport(HttpServletResponse response) throws IOException {
        locationService.downloadReport(response);
    }

    // ── Inner helper ──────────────────────────────────────────────────────────

    record ErrorBody(String message) {}
}
