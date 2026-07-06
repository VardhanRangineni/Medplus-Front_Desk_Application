package com.medplus.frontdesk_backend.client;

import com.medplus.frontdesk_backend.exception.ExternalApiException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Shortens public image URLs via mdpls.in (no auth).
 */
@Slf4j
@Component
public class MedplusShortenerClient {

    private final RestTemplate restTemplate;

    @Value("${medplus.shortener.base-url}")
    private String baseUrl;

    @Value("${medplus.shortener.expiry-days:30}")
    private int expiryDays;

    public MedplusShortenerClient(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public String shorten(String longUrl) {
        if (longUrl == null || longUrl.isBlank()) {
            throw new ExternalApiException("Cannot shorten empty URL");
        }
        if (!longUrl.startsWith("http://") && !longUrl.startsWith("https://")) {
            throw new ExternalApiException("Long URL must start with http:// or https://");
        }

        String url = UriComponentsBuilder
                .fromHttpUrl(baseUrl + "/shorten-api/shorten")
                .queryParam("longUrl", longUrl)
                .queryParam("noOfDays", expiryDays)
                .build()
                .toUriString();

        try {
            String body = restTemplate.getForObject(url, String.class);
            if (body == null || body.isBlank()) {
                throw new ExternalApiException("Shortener returned empty response");
            }
            String trimmed = body.trim();
            if (!trimmed.startsWith("http")) {
                throw new ExternalApiException("Shortener error: " + trimmed);
            }
            log.info("[MedplusShortener] Shortened URL → {}", trimmed);
            return trimmed;
        } catch (ExternalApiException ex) {
            throw ex;
        } catch (Exception ex) {
            log.error("[MedplusShortener] Error: {}", ex.getMessage());
            throw new ExternalApiException("URL shortening failed: " + ex.getMessage());
        }
    }
}
