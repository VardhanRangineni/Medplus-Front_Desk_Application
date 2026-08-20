package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.dto.KeyManagementContactDto;
import com.medplus.frontdesk_backend.repository.KeyManagementRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.util.StringUtils;

/**
 * After desk check-in, if the person-to-meet mobile is a Key Management contact,
 * SMS them a shortened portal URL (after DB commit).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class HostNotifyService {

    private final KeyManagementRepository keyManagementRepository;
    private final HostNotifyExecutor hostNotifyExecutor;

    @Value("${app.host-notify.enabled:true}")
    private boolean enabled;

    @Value("${app.host-notify.public-base-url:http://localhost:5175/}")
    private String publicBaseUrl;

    /**
     * True when the mobile is an active Key Management contact with a portal token.
     * Used at check-in to decide {@code PENDING_APPROVAL} vs {@code CHECKED_IN}.
     */
    public boolean isKeyManagementHost(String personToMeetPhone) {
        String digits = normalizeMobile(personToMeetPhone);
        if (digits == null) {
            return false;
        }
        return keyManagementRepository.findActiveByMobile(digits)
                .filter(c -> StringUtils.hasText(c.getPortalToken()))
                .isPresent();
    }

    /**
     * Schedules host SMS after the surrounding transaction commits.
     * No-op when disabled, phone invalid, or phone is not in Key Management.
     *
     * @return true when a Key Management host was matched (SMS scheduled or would be if enabled)
     */
    public boolean notifyIfKeyManagementHost(String personToMeetPhone, String hostDisplayName) {
        String digits = normalizeMobile(personToMeetPhone);
        if (digits == null) {
            return false;
        }

        var contactOpt = keyManagementRepository.findActiveByMobile(digits);
        if (contactOpt.isEmpty()) {
            log.debug("[HostNotify] No Key Management contact for ...{}", last4(digits));
            return false;
        }

        KeyManagementContactDto contact = contactOpt.get();
        String portalToken = contact.getPortalToken();
        if (!StringUtils.hasText(portalToken)) {
            log.warn("[HostNotify] Contact id={} missing portal_token", contact.getId());
            return false;
        }

        if (!enabled) {
            return true;
        }

        String nameForSms = StringUtils.hasText(hostDisplayName)
                ? hostDisplayName.trim()
                : (StringUtils.hasText(contact.getDisplayName()) ? contact.getDisplayName() : "Host");

        String longUrl = buildPortalUrl(portalToken);

        Runnable send = () -> hostNotifyExecutor.deliverAsync(digits, nameForSms, longUrl);

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    send.run();
                }
            });
        } else {
            send.run();
        }
        return true;
    }

    private String buildPortalUrl(String portalToken) {
        String base = publicBaseUrl == null ? "" : publicBaseUrl.trim();
        if (!base.endsWith("/")) {
            base = base + "/";
        }
        return base + portalToken.trim();
    }

    static String normalizeMobile(String mobile) {
        if (mobile == null) return null;
        String digits = mobile.replaceAll("\\D", "");
        if (digits.length() == 12 && digits.startsWith("91")) {
            digits = digits.substring(2);
        }
        if (!digits.matches("^[6-9]\\d{9}$")) {
            return null;
        }
        return digits;
    }

    private static String last4(String mobile) {
        return mobile != null && mobile.length() >= 4 ? mobile.substring(mobile.length() - 4) : "????";
    }
}
