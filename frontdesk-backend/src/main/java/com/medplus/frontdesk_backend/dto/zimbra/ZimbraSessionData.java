package com.medplus.frontdesk_backend.dto.zimbra;

import java.time.Instant;

/**
 * Structured session payload stored server-side.
 * authToken is NEVER sent to the client.
 */
public record ZimbraSessionData(
        String authToken,   // Zimbra credential — server-side only
        Instant expiresAt,  // min(zimbraLifetime, ourPolicy)
        String email        // user context for logging / cache keying
) {
    public boolean isExpired() {
        return Instant.now().isAfter(expiresAt);
    }
}
