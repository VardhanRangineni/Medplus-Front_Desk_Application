package com.medplus.frontdesk_backend.controller;

import com.medplus.frontdesk_backend.dto.ApiResponse;
import com.medplus.frontdesk_backend.dto.CreateKeyManagementContactDto;
import com.medplus.frontdesk_backend.dto.KeyManagementContactDto;
import com.medplus.frontdesk_backend.dto.KeyManagementListFilterDto;
import com.medplus.frontdesk_backend.dto.PagedResponseDto;
import com.medplus.frontdesk_backend.service.KeyManagementService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * CRUD for Key Management approver phone numbers.
 * Accessible to PRIMARY_ADMIN and REGIONAL_ADMIN (supervisor) only.
 */
@RestController
@RequestMapping("/api/key-management")
@RequiredArgsConstructor
public class KeyManagementController {

    private final KeyManagementService keyManagementService;

    @GetMapping("/contacts")
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN', 'REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<PagedResponseDto<KeyManagementContactDto>>> list(
            @RequestParam(required = false) String mobile,
            @RequestParam(required = false) String displayName,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        var filters = KeyManagementListFilterDto.builder()
                .mobile(mobile)
                .displayName(displayName)
                .status(status)
                .build();

        return ResponseEntity.ok(ApiResponse.success("Key Management contacts retrieved.",
                keyManagementService.list(filters, page, size)));
    }

    @PostMapping("/contacts")
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN', 'REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<KeyManagementContactDto>> create(
            @Valid @RequestBody CreateKeyManagementContactDto body,
            Authentication auth) {
        KeyManagementContactDto created = keyManagementService.create(body, auth.getName());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Key Management contact added.", created));
    }

    @PutMapping("/contacts/{id}")
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN', 'REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<KeyManagementContactDto>> update(
            @PathVariable long id,
            @Valid @RequestBody CreateKeyManagementContactDto body,
            Authentication auth) {
        KeyManagementContactDto updated = keyManagementService.update(id, body, auth.getName());
        return ResponseEntity.ok(ApiResponse.success("Key Management contact updated.", updated));
    }

    @DeleteMapping("/contacts/{id}")
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN', 'REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable long id) {
        keyManagementService.delete(id);
        return ResponseEntity.ok(ApiResponse.success("Key Management contact removed.", null));
    }

    @PostMapping("/contacts/{id}/regenerate-token")
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN', 'REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<KeyManagementContactDto>> regenerateToken(
            @PathVariable long id,
            Authentication auth) {
        KeyManagementContactDto updated = keyManagementService.regeneratePortalToken(id, auth.getName());
        return ResponseEntity.ok(ApiResponse.success(
                "Approval link regenerated. Old SMS links no longer work.", updated));
    }
}
