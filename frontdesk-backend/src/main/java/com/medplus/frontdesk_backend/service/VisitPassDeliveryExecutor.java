package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.client.MedplusImageClient;
import com.medplus.frontdesk_backend.client.MedplusShortenerClient;
import com.medplus.frontdesk_backend.client.MedplusSmsClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class VisitPassDeliveryExecutor {

    private final VisitCardRenderer visitCardRenderer;
    private final MedplusImageClient imageClient;
    private final MedplusShortenerClient shortenerClient;
    private final MedplusSmsClient smsClient;
    private final PreRegistrationService preRegistrationService;

    @Async
    public void deliverAsync(String token, String visitorName, String mobile) {
        deliver(token, visitorName, mobile);
    }

    public boolean deliver(String token, String visitorName, String mobile) {
        preRegistrationService.updateVisitPassStatus(token, "PENDING", null, null, null);

        try {
            byte[] png = visitCardRenderer.renderPng(visitorName, token);
            String filename = "MedPlus-VisitCard-" + token.substring(0, Math.min(8, token.length())) + ".png";
            String imageUrl = imageClient.uploadPng(png, filename);
            String shortUrl = shortenerClient.shorten(imageUrl);

            boolean smsOk = smsClient.sendVisitPassLink(mobile, shortUrl);
            if (smsOk) {
                preRegistrationService.updateVisitPassStatus(token, "SENT", imageUrl, shortUrl, null);
                log.info("[VisitPass] Delivered token={} mobile=...{}", token, last4(mobile));
                return true;
            }

            preRegistrationService.updateVisitPassStatus(
                    token, "FAILED", imageUrl, shortUrl, "SMS gateway rejected the request");
            return false;
        } catch (Exception ex) {
            log.error("[VisitPass] Delivery failed token={}: {}", token, ex.getMessage());
            preRegistrationService.updateVisitPassStatus(
                    token, "FAILED", null, null, truncate(ex.getMessage(), 250));
            return false;
        }
    }

    private static String last4(String mobile) {
        return mobile != null && mobile.length() >= 4 ? mobile.substring(mobile.length() - 4) : "????";
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }
}
