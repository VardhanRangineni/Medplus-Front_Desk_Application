package com.medplus.frontdesk_backend.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.medplus.frontdesk_backend.dto.OtpSendResponseDto;
import com.medplus.frontdesk_backend.dto.OtpVerifyResponseDto;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * MedplusOtpClient — sends and verifies visitor mobile OTPs via the MedPlus
 * message-service SMS gateway (deployment host: tpa.medplusindia.com).
 *
 * <p>Key insight from the message-service API contract:
 * <ul>
 *   <li>The outer {@code "status"} field in both send and verify responses is the
 *       HTTP-envelope status (was the request accepted).  It is always
 *       {@code "SUCCESS"} for a well-formed request regardless of OTP outcome.</li>
 *   <li>The actual OTP result lives in {@code data.status}: {@code "SUCCESS"}
 *       means the OTP matched; {@code "FAILURE"} (or absent) means it did not.</li>
 * </ul>
 *
 * <p>The SMS gateway generates and owns the OTP.  {@code smsParams} carries template
 * variables (e.g. validity duration) — NOT the OTP value.
 *
 * <p>Failures never throw to the UI layer — callers always get a DTO with a
 * short, operator-friendly message. Technical detail stays in logs.
 */
@Slf4j
@Component
public class MedplusOtpClient {

    private static final String MSG_SEND_UNAVAILABLE =
            "Unable to send OTP right now. Please try again in a moment.";
    private static final String MSG_VERIFY_UNAVAILABLE =
            "Unable to verify OTP right now. Please try again in a moment.";
    private static final String MSG_GATEWAY_ERROR =
            "SMS gateway returned an error. Please try again.";

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${medplus.otp.token-url}")
    private String tokenUrl;

    @Value("${medplus.otp.client-id}")
    private String clientId;

    @Value("${medplus.otp.client-secret}")
    private String clientSecret;

    @Value("${medplus.otp.send-url}")
    private String sendUrl;

    @Value("${medplus.otp.verify-url}")
    private String verifyUrl;

    @Value("${medplus.otp.vertical}")
    private String vertical;

    @Value("${medplus.otp.sms-template}")
    private String smsTemplate;

    @Value("${medplus.otp.requested-by}")
    private String requestedBy;

    private volatile String cachedToken;
    private volatile Instant tokenExpiresAt = Instant.EPOCH;

    /** Stores the exact token used to send each OTP so verify uses the same one. */
    private final ConcurrentHashMap<String, String> pendingOtpTokens = new ConcurrentHashMap<>();

    public MedplusOtpClient(RestTemplate restTemplate, ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    public OtpSendResponseDto sendOtp(String mobile) {
        try {
            String token = obtainAccessToken();

            Map<String, Object> body = new HashMap<>();
            body.put("otpRequestType", "GENERATE");
            body.put("vertical", vertical);
            body.put("requestedBy", requestedBy);
            body.put("mobile", mobile);
            body.put("smsParams", List.of("10min"));
            body.put("smsTemplate", smsTemplate);
            body.put("otpOn", "SMS");

            ResponseEntity<String> response = restTemplate.exchange(
                    sendUrl,
                    HttpMethod.POST,
                    new HttpEntity<>(body, bearerHeaders(token)),
                    String.class);

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                log.warn("[OTP] sendOtp non-2xx for mobile ...{}: {}", last4(mobile), response.getStatusCode());
                return new OtpSendResponseDto(false, MSG_GATEWAY_ERROR);
            }

            JsonNode root = objectMapper.readTree(response.getBody());
            log.debug("[OTP] sendOtp raw response for ...{}: {}", last4(mobile), response.getBody());
            String outerStatus = root.path("status").asText();
            if ("SUCCESS".equalsIgnoreCase(outerStatus)) {
                pendingOtpTokens.put(mobile, token);
                log.info("[OTP] OTP dispatched to mobile ...{}", last4(mobile));
                return new OtpSendResponseDto(true, "OTP sent successfully.");
            }

            String errMsg = root.path("message").asText(MSG_SEND_UNAVAILABLE);
            log.warn("[OTP] sendOtp failed for mobile ...{} (status={}): {}", last4(mobile), outerStatus, errMsg);
            return new OtpSendResponseDto(false, sanitizeGatewayMessage(errMsg, MSG_SEND_UNAVAILABLE));

        } catch (TokenException ex) {
            log.error("[OTP] sendOtp token failure for mobile ...{}: {}", last4(mobile), ex.getMessage());
            return new OtpSendResponseDto(false, MSG_SEND_UNAVAILABLE);
        } catch (HttpStatusCodeException ex) {
            log.error("[OTP] sendOtp HTTP {} for mobile ...{}: {}",
                    ex.getStatusCode().value(), last4(mobile), summarizeBody(ex.getResponseBodyAsString()));
            return new OtpSendResponseDto(false, MSG_GATEWAY_ERROR);
        } catch (ResourceAccessException ex) {
            log.error("[OTP] sendOtp network error for mobile ...{}: {}", last4(mobile), rootCause(ex));
            return new OtpSendResponseDto(false, MSG_SEND_UNAVAILABLE);
        } catch (Exception ex) {
            log.error("[OTP] sendOtp error for mobile ...{}: {}", last4(mobile), rootCause(ex));
            return new OtpSendResponseDto(false, MSG_SEND_UNAVAILABLE);
        }
    }

    public OtpVerifyResponseDto verifyOtp(String mobile, String otp) {
        try {
            String token = pendingOtpTokens.getOrDefault(mobile, obtainAccessToken());

            Map<String, Object> body = new HashMap<>();
            body.put("otp", otp.trim());
            body.put("source", mobile);
            body.put("smsTemplate", smsTemplate);
            body.put("vertical", vertical);
            body.put("verifiedBy", requestedBy);

            ResponseEntity<String> response = restTemplate.exchange(
                    verifyUrl,
                    HttpMethod.POST,
                    new HttpEntity<>(body, bearerHeaders(token)),
                    String.class);

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                log.warn("[OTP] verifyOtp non-2xx for mobile ...{}: {}", last4(mobile), response.getStatusCode());
                return new OtpVerifyResponseDto(false, "Invalid OTP. Please try again.");
            }

            JsonNode root = objectMapper.readTree(response.getBody());
            log.debug("[OTP] verifyOtp raw response for ...{}: {}", last4(mobile), response.getBody());

            String dataStatus = extractDataStatus(root);
            if ("SUCCESS".equalsIgnoreCase(dataStatus)) {
                pendingOtpTokens.remove(mobile);
                log.info("[OTP] OTP verified for mobile ...{}", last4(mobile));
                return new OtpVerifyResponseDto(true, "Mobile number verified successfully.");
            }

            log.info("[OTP] OTP mismatch for mobile ...{} (data.status={})", last4(mobile), dataStatus);
            return new OtpVerifyResponseDto(false, "Invalid OTP. Please try again.");

        } catch (TokenException ex) {
            log.error("[OTP] verifyOtp token failure for mobile ...{}: {}", last4(mobile), ex.getMessage());
            return new OtpVerifyResponseDto(false, MSG_VERIFY_UNAVAILABLE);
        } catch (HttpStatusCodeException ex) {
            log.error("[OTP] verifyOtp HTTP {} for mobile ...{}: {}",
                    ex.getStatusCode().value(), last4(mobile), summarizeBody(ex.getResponseBodyAsString()));
            return new OtpVerifyResponseDto(false, MSG_VERIFY_UNAVAILABLE);
        } catch (ResourceAccessException ex) {
            log.error("[OTP] verifyOtp network error for mobile ...{}: {}", last4(mobile), rootCause(ex));
            return new OtpVerifyResponseDto(false, MSG_VERIFY_UNAVAILABLE);
        } catch (Exception ex) {
            log.error("[OTP] verifyOtp error for mobile ...{}: {}", last4(mobile), rootCause(ex));
            return new OtpVerifyResponseDto(false, MSG_VERIFY_UNAVAILABLE);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String extractDataStatus(JsonNode root) {
        JsonNode dataNode = root.path("data");
        if (dataNode.isMissingNode() || dataNode.isNull()) {
            return "";
        }
        if (dataNode.isObject()) {
            return dataNode.path("status").asText("");
        }
        if (dataNode.isTextual()) {
            try {
                JsonNode inner = objectMapper.readTree(dataNode.asText());
                return inner.path("status").asText("");
            } catch (Exception e) {
                log.warn("[OTP] Could not parse data field as JSON: {}", dataNode.asText());
                return "";
            }
        }
        return "";
    }

    // ── OAuth ─────────────────────────────────────────────────────────────────

    private synchronized String obtainAccessToken() {
        if (cachedToken != null && Instant.now().isBefore(tokenExpiresAt.minusSeconds(15))) {
            return cachedToken;
        }

        if (clientId == null || clientId.isBlank() || clientSecret == null || clientSecret.isBlank()) {
            throw new TokenException("OTP OAuth client credentials are not configured.");
        }

        String basic = Base64.getEncoder().encodeToString(
                (clientId + ":" + clientSecret).getBytes(StandardCharsets.UTF_8));

        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.AUTHORIZATION, "Basic " + basic);
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));

        // grant_type in body (and usually also on the URL). Empty form body was
        // rejected by some MedPlus OAuth nodes even when grant_type was in the query.
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "client_credentials");

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    tokenUrl,
                    HttpMethod.POST,
                    new HttpEntity<>(form, headers),
                    String.class);

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw new TokenException("OTP OAuth token request failed with HTTP "
                        + response.getStatusCode().value());
            }

            JsonNode root = objectMapper.readTree(response.getBody());
            String accessToken = root.path("access_token").asText(null);
            if (accessToken == null || accessToken.isBlank()) {
                throw new TokenException("OTP OAuth response missing access_token.");
            }

            int expiresIn = root.path("expires_in").asInt(120);
            cachedToken = accessToken;
            tokenExpiresAt = Instant.now().plusSeconds(Math.max(30, expiresIn));
            log.debug("[OTP] OAuth token refreshed, expires in {}s", expiresIn);
            return cachedToken;

        } catch (TokenException ex) {
            throw ex;
        } catch (HttpStatusCodeException ex) {
            log.error("[OTP] OAuth HTTP {}: {}", ex.getStatusCode().value(),
                    summarizeBody(ex.getResponseBodyAsString()));
            throw new TokenException("OTP OAuth rejected credentials or request (HTTP "
                    + ex.getStatusCode().value() + ").");
        } catch (ResourceAccessException ex) {
            log.error("[OTP] OAuth network error: {}", rootCause(ex));
            throw new TokenException("OTP OAuth network error: " + rootCause(ex));
        } catch (Exception ex) {
            log.error("[OTP] OAuth unexpected error: {}", rootCause(ex));
            throw new TokenException("OTP OAuth unexpected error: " + rootCause(ex));
        }
    }

    private HttpHeaders bearerHeaders(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    private static String last4(String mobile) {
        if (mobile == null || mobile.length() < 4) return "****";
        return mobile.substring(mobile.length() - 4);
    }

    private static String rootCause(Throwable ex) {
        Throwable cur = ex;
        while (cur.getCause() != null && cur.getCause() != cur) {
            cur = cur.getCause();
        }
        String msg = cur.getMessage();
        if (msg == null || msg.isBlank()) {
            return cur.getClass().getSimpleName();
        }
        int newline = msg.indexOf('\n');
        String first = newline > 0 ? msg.substring(0, newline) : msg;
        return first.length() > 240 ? first.substring(0, 240) + "..." : first;
    }

    private static String summarizeBody(String body) {
        if (body == null || body.isBlank()) return "(empty body)";
        String trimmed = body.trim().replaceAll("\\s+", " ");
        return trimmed.length() > 240 ? trimmed.substring(0, 240) + "..." : trimmed;
    }

    /** Prefer gateway message only when it is short and non-technical. */
    private static String sanitizeGatewayMessage(String message, String fallback) {
        if (message == null) return fallback;
        String trimmed = message.trim();
        if (trimmed.isEmpty() || trimmed.length() > 160) return fallback;
        String lower = trimmed.toLowerCase();
        if (lower.contains("oauth") || lower.contains("token") || lower.contains("exception")
                || lower.contains("stack") || lower.contains("http")) {
            return fallback;
        }
        return trimmed;
    }

    /** Internal — never exposed directly to API clients. */
    private static final class TokenException extends RuntimeException {
        TokenException(String message) {
            super(message);
        }
    }
}
