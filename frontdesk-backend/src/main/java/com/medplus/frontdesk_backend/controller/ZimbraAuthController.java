package com.medplus.frontdesk_backend.controller;

import com.medplus.frontdesk_backend.config.ZimbraLoginRateLimiter;
import com.medplus.frontdesk_backend.dto.zimbra.ZimbraLoginRequestDto;
import com.medplus.frontdesk_backend.dto.zimbra.ZimbraLoginResponseDto;
import com.medplus.frontdesk_backend.service.ZimbraAuthService;
import com.medplus.frontdesk_backend.service.ZimbraAuthService.ZimbraLoginResult;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;

@Slf4j
@RestController
@RequestMapping("/zimbra/auth")
@RequiredArgsConstructor
public class ZimbraAuthController {

    @Value("${zimbra.session.ttl-seconds:28800}")
    private long sessionTtlSeconds;

    private final ZimbraAuthService zimbraAuthService;
    private final ZimbraLoginRateLimiter rateLimiter;

    @PostMapping("/login")
    public ResponseEntity<?> login(
            @Valid @RequestBody ZimbraLoginRequestDto request,
            HttpServletRequest httpRequest) {

        String clientIp = getClientIp(httpRequest);
        if (!rateLimiter.isAllowed(clientIp)) {
            log.warn("Login rate limit hit for IP {}", clientIp);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body("Too many login attempts. Please try again in 15 minutes.");
        }

        ZimbraLoginResult result = zimbraAuthService.login(request);

        // Set sessionId in HttpOnly cookie — never exposed to JavaScript
        ResponseCookie cookie = ResponseCookie.from("zimbraSessionId", result.sessionId())
                .httpOnly(true)
                .secure(false)          // set true when behind HTTPS in production
                .sameSite("Strict")
                .path("/zimbra")
                .maxAge(Duration.ofSeconds(sessionTtlSeconds))
                .build();

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(new ZimbraLoginResponseDto(result.email()));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        // Read sessionId from cookie to invalidate server-side
        String sessionId = extractCookieValue(request, "zimbraSessionId");
        zimbraAuthService.logout(sessionId);

        // Clear the cookie by setting Max-Age=0
        ResponseCookie clearCookie = ResponseCookie.from("zimbraSessionId", "")
                .httpOnly(true)
                .secure(false)
                .sameSite("Strict")
                .path("/zimbra")
                .maxAge(0)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, clearCookie.toString());
        return ResponseEntity.noContent().build();
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private String getClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
        return request.getRemoteAddr();
    }

    private String extractCookieValue(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        for (Cookie c : cookies) {
            if (name.equals(c.getName())) return c.getValue();
        }
        return null;
    }
}
