package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.dto.zimbra.ZimbraLoginRequestDto;
import com.medplus.frontdesk_backend.dto.zimbra.ZimbraLoginResponseDto;
import com.medplus.frontdesk_backend.exception.ZimbraException;
import com.medplus.frontdesk_backend.integration.ZimbraSoapClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.w3c.dom.Document;
import org.w3c.dom.NodeList;

@Slf4j
@Service
@RequiredArgsConstructor
public class ZimbraAuthService {

    // Default 48 h — overridden by what Zimbra actually returns
    private static final long DEFAULT_LIFETIME_MS = 48L * 60 * 60 * 1000;

    private final ZimbraSoapClient zimbraSoapClient;
    private final ZimbraSessionService zimbraSessionService;

    public ZimbraLoginResult login(ZimbraLoginRequestDto request) {
        // password intentionally not logged
        log.info("Zimbra login attempt for: {}", request.getEmail());
        long start = System.currentTimeMillis();

        Document doc = zimbraSoapClient.authenticate(request.getEmail(), request.getPassword());

        String authToken = extractText(doc, "authToken");
        if (authToken == null || authToken.isBlank()) {
            throw new ZimbraException("Empty authToken in Zimbra response");
        }

        long lifetimeMs = extractLifetimeMs(doc);
        String sessionId = zimbraSessionService.createSession(authToken, lifetimeMs, request.getEmail());

        log.info("Zimbra login successful for {} in {}ms (zimbraLifetime={}ms)",
                request.getEmail(), System.currentTimeMillis() - start, lifetimeMs);

        return new ZimbraLoginResult(sessionId, request.getEmail());
    }

    public void logout(String sessionId) {
        zimbraSessionService.invalidateSession(sessionId);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private String extractText(Document doc, String tag) {
        NodeList nodes = doc.getElementsByTagName(tag);
        return nodes.getLength() > 0 ? nodes.item(0).getTextContent().trim() : null;
    }

    private long extractLifetimeMs(Document doc) {
        String raw = extractText(doc, "lifetime");
        if (raw != null) {
            try { return Long.parseLong(raw); } catch (NumberFormatException ignored) {}
        }
        log.warn("Could not extract lifetime from Zimbra response — using default {}ms", DEFAULT_LIFETIME_MS);
        return DEFAULT_LIFETIME_MS;
    }

    /** Internal transfer object — not exposed to HTTP layer. */
    public record ZimbraLoginResult(String sessionId, String email) {}
}
