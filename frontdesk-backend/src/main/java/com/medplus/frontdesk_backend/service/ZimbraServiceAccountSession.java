package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.exception.ZimbraException;
import com.medplus.frontdesk_backend.integration.ZimbraSoapClient;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.NodeList;

import java.time.Instant;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Maintains a long-lived, auto-refreshing Zimbra auth token for the
 * service account (noreply.calendar@medplusindia.com).
 *
 * Thread-safe via double-checked locking.
 * The password is never logged or exposed to any API response.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ZimbraServiceAccountSession {

    // Default Zimbra token lifetime is 48 h; we refresh 5 min before actual expiry
    private static final long DEFAULT_LIFETIME_MS = 48L * 60 * 60 * 1000;

    @Getter
    @Value("${zimbra.service-account.email}")
    private String email;

    @Value("${zimbra.service-account.password}")
    private String password;   // never logged

    @Value("${zimbra.service-account.refresh-buffer-ms:300000}")
    private long refreshBufferMs;

    private final ZimbraSoapClient zimbraSoapClient;

    private volatile String  cachedToken;
    private volatile Instant tokenExpiresAt;
    private final ReentrantLock lock = new ReentrantLock();

    /**
     * Returns a valid service account authToken.
     * Automatically re-authenticates when the token is expired or close to expiry.
     */
    public String getToken() {
        if (isValid()) return cachedToken;
        return refreshToken();
    }

    private boolean isValid() {
        return cachedToken != null
                && tokenExpiresAt != null
                && Instant.now().isBefore(tokenExpiresAt.minusMillis(refreshBufferMs));
    }

    private String refreshToken() {
        lock.lock();
        try {
            // Second check after acquiring lock (another thread may have already refreshed)
            if (isValid()) return cachedToken;

            log.info("[ZimbraServiceAccount] Refreshing token for {}", email);
            long start = System.currentTimeMillis();

            Document doc = zimbraSoapClient.authenticate(email, password);

            String token       = extractText(doc, "authToken");
            long   lifetimeMs  = extractLong(doc, "lifetime", DEFAULT_LIFETIME_MS);

            if (token == null || token.isBlank()) {
                throw new ZimbraException("Service account authentication failed: empty authToken");
            }

            cachedToken    = token;
            tokenExpiresAt = Instant.now().plusMillis(lifetimeMs);

            log.info("[ZimbraServiceAccount] Token refreshed in {}ms | expires at {}",
                    System.currentTimeMillis() - start, tokenExpiresAt);
            return cachedToken;

        } finally {
            lock.unlock();
        }
    }

    /** Invalidate the cached token (e.g. after receiving AUTH_EXPIRED from Zimbra). */
    public void invalidate() {
        lock.lock();
        try {
            cachedToken    = null;
            tokenExpiresAt = null;
            log.info("[ZimbraServiceAccount] Token invalidated — will re-auth on next use");
        } finally {
            lock.unlock();
        }
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private static String extractText(Document doc, String tag) {
        NodeList nodes = doc.getElementsByTagName(tag);
        return nodes.getLength() > 0 ? nodes.item(0).getTextContent().trim() : null;
    }

    private static long extractLong(Document doc, String tag, long fallback) {
        String raw = extractText(doc, tag);
        if (raw != null) { try { return Long.parseLong(raw); } catch (NumberFormatException ignored) {} }
        return fallback;
    }
}
