package com.medplus.frontdesk_backend.controller;

import com.medplus.frontdesk_backend.dto.ApiResponse;
import com.medplus.frontdesk_backend.dto.PagedResponseDto;
import com.medplus.frontdesk_backend.dto.UserDto;
import com.medplus.frontdesk_backend.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    /**
     * GET /api/users
     *
     * Returns a paginated page of employees from the local usermaster table.
     * Supports optional full-text search over id, name, department, and work location.
     *
     * Query params:
     *   q    (optional) — case-insensitive search term
     *   page (optional) — 0-based page index (default 0)
     *   size (optional) — records per page (default 20)
     */
    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponseDto<UserDto>>> getUsers(
            @RequestParam(required = false)                  String q,
            @RequestParam(defaultValue = "0")                int    page,
            @RequestParam(defaultValue = "20")               int    size) {

        PagedResponseDto<UserDto> result = userService.getUsersPaged(q, page, size);
        return ResponseEntity.ok(ApiResponse.success("Users retrieved successfully", result));
    }

    /**
     * POST /api/users/sync
     *
     * Pulls the latest employee data from the external HR API,
     * upserts into usermaster, and returns the full updated list.
     * Restricted to PRIMARY_ADMIN and REGIONAL_ADMIN.
     */
    @PostMapping("/sync")
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN', 'REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<List<UserDto>>> syncUsers(
            @AuthenticationPrincipal UserDetails principal) {

        String triggeredBy = principal != null ? principal.getUsername() : "UNKNOWN";
        List<UserDto> users = userService.syncAndGetUsers(triggeredBy);
        return ResponseEntity.ok(ApiResponse.success("Users synced successfully", users));
    }
}
