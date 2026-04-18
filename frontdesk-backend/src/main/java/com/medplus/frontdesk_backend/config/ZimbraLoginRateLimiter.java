package com.medplus.frontdesk_backend.config;

import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.concurrent.*;

/**
 * Sliding-window rate limiter for Zimbra login attempts.
 * Limits to MAX_ATTEMPTS per IP within WINDOW_SECONDS.
 * Uses a background thread to evict stale entries every 5 minutes.
 */
@Slf4j
@Component
public class ZimbraLoginRateLimiter {

    private static final int  MAX_ATTEMPTS     = 5;
    private static final long WINDOW_SECONDS   = 15 * 60L;  // 15 minutes

    private record Window(int count, Instant windowStart) {
        boolean isExpired() {
            return Instant.now().isAfter(windowStart.plusSeconds(WINDOW_SECONDS));
        }
        Window increment() {
            return new Window(count + 1, windowStart);
        }
    }

    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
    private final ScheduledExecutorService cleaner =
            Executors.newSingleThreadScheduledExecutor(r -> {
                Thread t = new Thread(r, "zimbra-ratelimit-cleaner");
                t.setDaemon(true);
                return t;
            });

    public ZimbraLoginRateLimiter() {
        cleaner.scheduleAtFixedRate(this::evictExpired, 5, 5, TimeUnit.MINUTES);
    }

    /**
     * Returns true if the request is allowed; false if rate limit exceeded.
     */
    public boolean isAllowed(String clientIp) {
        Window current = windows.compute(clientIp, (ip, existing) -> {
            if (existing == null || existing.isExpired()) {
                return new Window(1, Instant.now());
            }
            return existing.increment();
        });

        if (current.count() > MAX_ATTEMPTS) {
            log.warn("Rate limit exceeded for IP {} ({} attempts in window)", clientIp, current.count());
            return false;
        }
        return true;
    }

    private void evictExpired() {
        windows.entrySet().removeIf(e -> e.getValue().isExpired());
    }

    @PreDestroy
    public void shutdown() {
        cleaner.shutdownNow();
    }
}
