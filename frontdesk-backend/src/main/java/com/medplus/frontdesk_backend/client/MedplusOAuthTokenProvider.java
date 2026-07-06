package com.medplus.frontdesk_backend.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.medplus.frontdesk_backend.exception.ExternalApiException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.List;

@Slf4j
public class MedplusOAuthTokenProvider {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String tokenUrl;
    private final String clientId;
    private final String clientSecret;
    private final String logLabel;

    private volatile String cachedToken;
    private volatile Instant tokenExpiresAt = Instant.EPOCH;

    public MedplusOAuthTokenProvider(RestTemplate restTemplate,
                                     ObjectMapper objectMapper,
                                     String tokenUrl,
                                     String clientId,
                                     String clientSecret,
                                     String logLabel) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.tokenUrl = tokenUrl;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.logLabel = logLabel;
    }

    public synchronized String getAccessToken() {
        if (cachedToken != null && Instant.now().isBefore(tokenExpiresAt.minusSeconds(15))) {
            return cachedToken;
        }

        String basic = Base64.getEncoder().encodeToString(
                (clientId + ":" + clientSecret).getBytes(StandardCharsets.UTF_8));

        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.AUTHORIZATION, "Basic " + basic);
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "client_credentials");

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    tokenUrl,
                    HttpMethod.POST,
                    new HttpEntity<>(form, headers),
                    String.class);

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw new ExternalApiException("OAuth token request failed for " + logLabel);
            }

            JsonNode root = objectMapper.readTree(response.getBody());
            cachedToken = root.path("access_token").asText(null);
            if (cachedToken == null || cachedToken.isBlank()) {
                throw new ExternalApiException("OAuth response missing access_token for " + logLabel);
            }
            int expiresIn = root.path("expires_in").asInt(119);
            tokenExpiresAt = Instant.now().plusSeconds(Math.max(30, expiresIn));
            log.debug("[{}] OAuth token refreshed, expires in {}s", logLabel, expiresIn);
            return cachedToken;
        } catch (ExternalApiException ex) {
            throw ex;
        } catch (HttpStatusCodeException ex) {
            log.error("[{}] OAuth HTTP {}: {}", logLabel, ex.getStatusCode().value(), summarizeError(ex));
            throw new ExternalApiException("Unable to obtain OAuth token for " + logLabel);
        } catch (ResourceAccessException ex) {
            log.error("[{}] OAuth network error: {}", logLabel, summarizeError(ex));
            throw new ExternalApiException("Unable to obtain OAuth token for " + logLabel);
        } catch (Exception ex) {
            log.error("[{}] OAuth token error: {}", logLabel, summarizeError(ex));
            throw new ExternalApiException("Unable to obtain OAuth token for " + logLabel);
        }
    }

    private static String summarizeError(Exception ex) {
        String message = ex.getMessage();
        if (message == null) {
            return ex.getClass().getSimpleName();
        }
        int newline = message.indexOf('\n');
        String firstLine = newline > 0 ? message.substring(0, newline) : message;
        if (firstLine.length() > 240) {
            return firstLine.substring(0, 240) + "...";
        }
        return firstLine;
    }
}
