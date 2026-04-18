package com.medplus.frontdesk_backend.config;

import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.*;

/**
 * Lightweight in-memory TTL cache for Zimbra API responses.
 * Default TTL: 30 seconds — reduces redundant SOAP calls.
 * Keys are scoped per user email to prevent cross-user cache pollution.
 *
 * Usage:
 *   String key = cache.key(email, "inbox", "20");
 *   return cache.get(key, List.class).orElseGet(() -> {
 *       List<MailDto> fresh = fetchFromZimbra();
 *       cache.put(key, fresh);
 *       return fresh;
 *   });
 */
@Slf4j
@Component
public class ZimbraCache {

    public static final Duration DEFAULT_TTL = Duration.ofSeconds(30);

    private record Entry<T>(T data, Instant expiresAt) {
        boolean isExpired() { return Instant.now().isAfter(expiresAt); }
    }

    private final ConcurrentHashMap<String, Entry<?>> store = new ConcurrentHashMap<>();
    private final ScheduledExecutorService cleaner =
            Executors.newSingleThreadScheduledExecutor(r -> {
                Thread t = new Thread(r, "zimbra-cache-cleaner");
                t.setDaemon(true);
                return t;
            });

    public ZimbraCache() {
        cleaner.scheduleAtFixedRate(this::evictExpired, 60, 60, TimeUnit.SECONDS);
    }

    /** Build a scoped cache key. */
    public String key(String email, String... parts) {
        return email + ":" + String.join(":", parts);
    }

    @SuppressWarnings("unchecked")
    public <T> Optional<T> get(String key) {
        Entry<?> entry = store.get(key);
        if (entry == null || entry.isExpired()) {
            store.remove(key);
            return Optional.empty();
        }
        log.debug("[ZimbraCache] HIT  {}", key);
        return Optional.of((T) entry.data());
    }

    public <T> void put(String key, T data) {
        put(key, data, DEFAULT_TTL);
    }

    public <T> void put(String key, T data, Duration ttl) {
        store.put(key, new Entry<>(data, Instant.now().plus(ttl)));
        log.debug("[ZimbraCache] MISS {} — cached for {}s", key, ttl.toSeconds());
    }

    /** Evict all entries whose key starts with the given prefix (e.g. user logout). */
    public void evictByPrefix(String prefix) {
        store.keySet().removeIf(k -> k.startsWith(prefix));
    }

    private void evictExpired() {
        int before = store.size();
        store.entrySet().removeIf(e -> e.getValue().isExpired());
        int removed = before - store.size();
        if (removed > 0) log.debug("[ZimbraCache] Evicted {} expired entries", removed);
    }

    @PreDestroy
    public void shutdown() {
        cleaner.shutdownNow();
    }
}
