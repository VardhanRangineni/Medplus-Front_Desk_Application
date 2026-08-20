package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.client.MedplusShortenerClient;
import com.medplus.frontdesk_backend.client.MedplusSmsClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class HostNotifyExecutor {

    private final MedplusShortenerClient shortenerClient;
    private final MedplusSmsClient smsClient;

    @Async
    public void deliverAsync(String mobile, String hostDisplayName, String longPortalUrl) {
        try {
            String shortUrl = shortenerClient.shorten(longPortalUrl);
            boolean ok = smsClient.sendHostArrivalNotify(mobile, hostDisplayName, shortUrl);
            if (ok) {
                log.info("[HostNotify] SMS sent to ...{} shortUrl={}", last4(mobile), shortUrl);
            } else {
                log.warn("[HostNotify] SMS rejected for ...{}", last4(mobile));
            }
        } catch (Exception ex) {
            log.error("[HostNotify] Failed for ...{}: {}", last4(mobile), ex.getMessage());
        }
    }

    private static String last4(String mobile) {
        return mobile != null && mobile.length() >= 4 ? mobile.substring(mobile.length() - 4) : "????";
    }
}
