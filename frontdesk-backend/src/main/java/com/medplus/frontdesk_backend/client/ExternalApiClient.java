package com.medplus.frontdesk_backend.client;

import com.medplus.frontdesk_backend.dto.external.ExternalEmployeeDto;
import com.medplus.frontdesk_backend.dto.external.ExternalLocationDto;
import com.medplus.frontdesk_backend.exception.ExternalApiException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.List;

/**
 * Thin HTTP client for the external Medplus HR/ERP API.
 *
 * All requests carry the X-Api-Key header for authentication.
 * Replace the dummy base-url and key in application.properties
 * with real values when the external API is available.
 */
@Slf4j
@Component
public class ExternalApiClient {

    private final RestTemplate restTemplate;
    private final String baseUrl;
    private final String apiKey;
    private final String employeesPath;
    private final String locationsPath;

    public ExternalApiClient(
            RestTemplate restTemplate,
            @Value("${external.api.base-url}")       String baseUrl,
            @Value("${external.api.key}")             String apiKey,
            @Value("${external.api.employees-path}") String employeesPath,
            @Value("${external.api.locations-path}") String locationsPath) {

        this.restTemplate   = restTemplate;
        this.baseUrl        = baseUrl;
        this.apiKey         = apiKey;
        this.employeesPath  = employeesPath;
        this.locationsPath  = locationsPath;
    }

    // ── Public methods ────────────────────────────────────────────────────────

    public List<ExternalEmployeeDto> fetchEmployees() {
        String url = baseUrl + employeesPath;
        log.info("Fetching employees from external API: {}", url);
        try {
            ResponseEntity<List<ExternalEmployeeDto>> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    buildRequest(),
                    new ParameterizedTypeReference<>() {}
            );
            List<ExternalEmployeeDto> body = response.getBody();
            log.info("External API returned {} employee records", body == null ? 0 : body.size());
            return body == null ? List.of() : body;
        } catch (RestClientException ex) {
            log.error("Failed to fetch employees from external API: {}", ex.getMessage());
            throw new ExternalApiException("Could not reach the external HR API to fetch employees: " + ex.getMessage(), ex);
        }
    }

    public List<ExternalLocationDto> fetchLocations() {
        String url = baseUrl + locationsPath;
        log.info("Fetching locations from external API: {}", url);
        try {
            ResponseEntity<List<ExternalLocationDto>> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    buildRequest(),
                    new ParameterizedTypeReference<>() {}
            );
            List<ExternalLocationDto> body = response.getBody();
            log.info("External API returned {} location records", body == null ? 0 : body.size());
            return body == null ? List.of() : body;
        } catch (RestClientException ex) {
            log.error("Failed to fetch locations from external API: {}", ex.getMessage());
            throw new ExternalApiException("Could not reach the external HR API to fetch locations: " + ex.getMessage(), ex);
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private HttpEntity<Void> buildRequest() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Api-Key", apiKey);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        return new HttpEntity<>(headers);
    }
}
