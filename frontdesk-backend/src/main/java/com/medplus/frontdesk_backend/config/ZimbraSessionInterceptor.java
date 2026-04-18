package com.medplus.frontdesk_backend.config;

import com.medplus.frontdesk_backend.dto.zimbra.ZimbraSessionData;
import com.medplus.frontdesk_backend.integration.ZimbraContext;
import com.medplus.frontdesk_backend.service.ZimbraSessionService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Validates every Zimbra API request (except /login and /logout).
 * Resolves sessionId → authToken and stores in ZimbraContext for the current thread.
 * SessionId is read from: 1) HttpOnly cookie  2) "sessionId" header (fallback)
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ZimbraSessionInterceptor implements HandlerInterceptor {

    private final ZimbraSessionService zimbraSessionService;

    @Override
    public boolean preHandle(HttpServletRequest request,
                             HttpServletResponse response,
                             Object handler) {

        String sessionId = extractSessionId(request);
        ZimbraSessionData data = zimbraSessionService.resolve(sessionId);

        ZimbraContext.set(data.authToken(), data.email());

        log.debug("[Zimbra] {} {} | user={}", request.getMethod(), request.getRequestURI(), data.email());
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request,
                                HttpServletResponse response,
                                Object handler,
                                Exception ex) {
        ZimbraContext.clear();
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private String extractSessionId(HttpServletRequest request) {
        // Prefer HttpOnly cookie
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie c : cookies) {
                if ("zimbraSessionId".equals(c.getName())) return c.getValue();
            }
        }
        // Fallback: header (supports curl / Postman / legacy clients)
        return request.getHeader("sessionId");
    }
}
