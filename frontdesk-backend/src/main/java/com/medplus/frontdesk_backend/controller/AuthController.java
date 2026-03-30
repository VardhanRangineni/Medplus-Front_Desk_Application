package com.medplus.frontdesk_backend.controller;

import com.medplus.frontdesk_backend.dto.ApiResponse;
import com.medplus.frontdesk_backend.dto.LoginRequestDto;
import com.medplus.frontdesk_backend.dto.LoginResponseDto;
import com.medplus.frontdesk_backend.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /**
     * POST /api/auth/login
     *
     * Request body:
     * {
     *   "employeeId": "Admin",
     *   "password":   "Admin"
     * }
     *
     * Success response (200):
     * {
     *   "success": true,
     *   "message": "Login successful",
     *   "data": {
     *     "token":        "<jwt>",
     *     "tokenType":    "Bearer",
     *     "employeeId":   "Admin",
     *     "role":         "PRIMARY_ADMIN",
     *     "fullName":     "Admin User",
     *     "locationId":   "HO-HO-HYD",
     *     "locationName": "Medplus Head Office Hyderabad",
     *     "expiresIn":    86400
     *   },
     *   "timestamp": "..."
     * }
     */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponseDto>> login(
            @Valid @RequestBody LoginRequestDto request) {

        LoginResponseDto loginResponse = authService.login(request);
        return ResponseEntity.ok(ApiResponse.success("Login successful", loginResponse));
    }

    @GetMapping("/health")
    public ResponseEntity<ApiResponse<String>> health() {
        return ResponseEntity.ok(ApiResponse.success("Auth service is running", "OK"));
    }
}
