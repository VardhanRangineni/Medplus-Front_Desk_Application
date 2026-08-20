package com.medplus.frontdesk_backend.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.medplus.frontdesk_backend.exception.ExternalApiException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

/**
 * Sends transactional SMS via MedPlus message-service (MVMS_QR template on tpa).
 */
@Slf4j
@Component
public class MedplusSmsClient {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final MedplusOAuthTokenProvider oauth;

    @Value("${medplus.sms.send-url}")
    private String sendUrl;

    @Value("${medplus.sms.template}")
    private String smsTemplate;

    @Value("${medplus.sms.host-notify-template:MVMS_QR}")
    private String hostNotifyTemplate;

    @Value("${medplus.sms.host-notify-include-name:false}")
    private boolean hostNotifyIncludeName;

    public MedplusSmsClient(RestTemplate restTemplate,
                            ObjectMapper objectMapper,
                            @Value("${medplus.otp.token-url}") String tokenUrl,
                            @Value("${medplus.otp.client-id}") String clientId,
                            @Value("${medplus.otp.client-secret}") String clientSecret) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.oauth = new MedplusOAuthTokenProvider(
                restTemplate, objectMapper, tokenUrl, clientId, clientSecret, "MedplusSMS");
    }

    /**
     * Enqueues an SMS with the visit-pass short URL. Returns true if accepted by the gateway queue.
     */
    public boolean sendVisitPassLink(String mobile, String shortUrl) {
        return sendSms(mobile, smsTemplate, List.of(shortUrl), "visit-pass");
    }

    /**
     * Host arrival SMS for Key Management.
     * <p>
     * Future template ({@code Dear {#alp#} ... View details: {#urg#}}) expects
     * {@code smsParams = [hostName, shortUrl]}. Until that template is registered,
     * set {@code medplus.sms.host-notify-include-name=false} and reuse a URL-only
     * template (e.g. {@code MVMS_QR}) so only the short URL is sent.
     */
    public boolean sendHostArrivalNotify(String mobile, String hostDisplayName, String shortUrl) {
        List<String> params = hostNotifyIncludeName
                ? List.of(hostDisplayName != null ? hostDisplayName.trim() : "", shortUrl)
                : List.of(shortUrl);
        return sendSms(mobile, hostNotifyTemplate, params, "host-notify");
    }

    private boolean sendSms(String mobile, String template, List<String> smsParams, String purpose) {
        String digits = mobile != null ? mobile.replaceAll("\\D", "") : "";
        String bearer = oauth.getAccessToken();

        Map<String, Object> body = Map.of(
                "mobile", digits,
                "smsTemplate", template,
                "smsParams", smsParams
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(bearer);
        headers.setContentType(MediaType.APPLICATION_JSON);

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    sendUrl,
                    HttpMethod.POST,
                    new HttpEntity<>(body, headers),
                    String.class);

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                log.warn("[MedplusSMS] {} send non-2xx for mobile ...{}", purpose, last4(mobile));
                return false;
            }

            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode data = root.path("data");
            if (data.isTextual()) {
                try {
                    data = objectMapper.readTree(data.asText());
                } catch (Exception ignored) {
                    // keep as text node
                }
            }
            String innerStatus = data.path("status").asText("");
            boolean ok = "SUCCESS".equalsIgnoreCase(innerStatus);
            if (!ok) {
                log.warn("[MedplusSMS] {} enqueue failed for ...{}: {}",
                        purpose, last4(mobile), data.path("message").asText(""));
            } else {
                log.info("[MedplusSMS] {} SMS enqueued for mobile ...{}", purpose, last4(mobile));
            }
            return ok;
        } catch (Exception ex) {
            log.error("[MedplusSMS] {} send error for ...{}: {}", purpose, last4(mobile), ex.getMessage());
            return false;
        }
    }

    private static String last4(String mobile) {
        if (mobile == null || mobile.length() < 4) return "????";
        return mobile.substring(mobile.length() - 4);
    }
}
