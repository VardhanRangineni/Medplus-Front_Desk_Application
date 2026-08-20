package com.medplus.frontdesk_backend.scheduler;

import com.medplus.frontdesk_backend.repository.OtpTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.ZoneId;

/**
 * OtpCleanupScheduler — scheduled task to bulk-delete expired OTP tokens from the database.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OtpCleanupScheduler {

    private final OtpTokenRepository otpTokenRepository;

    /**
     * Delete expired OTP tokens from the database.
     * Runs every 10 minutes.
     */
    @Scheduled(cron = "0 */10 * * * *")
    public void cleanupExpiredTokens() {
        log.debug("[OtpCleanupScheduler] Running scheduled cleanup of expired OTP tokens");
        try {
            int deleted = otpTokenRepository.deleteExpired(LocalDateTime.now(ZoneId.of("Asia/Kolkata")));
            if (deleted > 0) {
                log.info("[OtpCleanupScheduler] Cleaned up {} expired OTP tokens", deleted);
            }
        } catch (Exception ex) {
            log.error("[OtpCleanupScheduler] Error during cleanup of expired OTP tokens: {}", ex.getMessage());
        }
    }
}
