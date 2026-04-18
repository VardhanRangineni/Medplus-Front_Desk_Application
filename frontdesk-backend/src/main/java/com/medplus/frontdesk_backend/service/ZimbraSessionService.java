package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.dto.zimbra.ZimbraSessionData;
import com.medplus.frontdesk_backend.exception.ZimbraSessionNotFoundException;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.*;

@Slf4j
@Service
public class ZimbraSessionService {

    @Value("${zimbra.session.ttl-seconds:28800}")
    private long sessionTtlSeconds;

    private final ConcurrentHashMap<String, ZimbraSessionData> sessions = new ConcurrentHashMap<>();
    private final ScheduledExecutorService cleaner =
            Executors.newSingleThreadScheduledExecutor(r -> {
                Thread t = new Thread(r, "zimbra-session-cleaner");
                t.setDaemon(true);
                return t;
            });

    public ZimbraSessionService() {
        cleaner.scheduleAtFixedRate(this::evictExpired, 10, 10, TimeUnit.MINUTES);
    }

    /**
     * Creates a new session storing structured data.
     * TTL = min(Zimbra's own lifetime, our policy) — whichever expires first.
     *
     * @param authToken      Zimbra authToken
     * @param zimbraLifetimeMs  lifetime returned by Zimbra's AuthResponse (milliseconds)
     * @param email          user's email address
     * @return opaque sessionId (UUID)
     */
    public String createSession(String authToken, long zimbraLifetimeMs, String email) {
        Instant zimbraExpiry = Instant.now().plusMillis(zimbraLifetimeMs);
        Instant policyExpiry = Instant.now().plusSeconds(sessionTtlSeconds);
        // Honour whichever expiry comes first
        Instant effectiveExpiry = zimbraExpiry.isBefore(policyExpiry) ? zimbraExpiry : policyExpiry;

        String sessionId = UUID.randomUUID().toString();
        ZimbraSessionData data = new ZimbraSessionData(authToken, effectiveExpiry, email);
        sessions.put(sessionId, data);

        log.debug("Zimbra session created for {} | expires at {} | sessionId={}",
                email, effectiveExpiry, sessionId);
        return sessionId;
    }

    /**
     * Resolves sessionId → ZimbraSessionData.
     * Throws ZimbraSessionNotFoundException if absent or expired.
     */
    public ZimbraSessionData resolve(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            throw new ZimbraSessionNotFoundException("(blank)");
        }
        ZimbraSessionData data = sessions.get(sessionId);
        if (data == null || data.isExpired()) {
            sessions.remove(sessionId);
            throw new ZimbraSessionNotFoundException(sessionId);
        }
        return data;
    }

    public void invalidateSession(String sessionId) {
        if (sessionId != null && !sessionId.isBlank()) {
            ZimbraSessionData removed = sessions.remove(sessionId);
            if (removed != null) {
                log.debug("Zimbra session invalidated for {}", removed.email());
            }
        }
    }

    private void evictExpired() {
        int before = sessions.size();
        sessions.entrySet().removeIf(e -> e.getValue().isExpired());
        int removed = before - sessions.size();
        if (removed > 0) log.info("Evicted {} expired Zimbra sessions", removed);
    }

    @PreDestroy
    public void shutdown() {
        cleaner.shutdownNow();
    }
}
