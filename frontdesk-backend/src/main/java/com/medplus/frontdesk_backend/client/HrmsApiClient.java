package com.medplus.frontdesk_backend.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.medplus.frontdesk_backend.dto.HrmsEmployeeDto;
import com.medplus.frontdesk_backend.exception.ExternalApiException;
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
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Slf4j
@Component
public class HrmsApiClient {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${hrms.oauth.token-url}")
    private String tokenUrl;

    @Value("${hrms.oauth.client-id}")
    private String clientId;

    @Value("${hrms.oauth.client-secret}")
    private String clientSecret;

    @Value("${hrms.api.employee-details-url}")
    private String employeeDetailsUrl;

    private volatile String cachedAccessToken;
    private volatile Instant tokenExpiresAt = Instant.EPOCH;

    public HrmsApiClient(RestTemplate restTemplate, ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    public Optional<HrmsEmployeeDto> fetchByEmployeeId(String employeeId) {
        if (employeeId == null || employeeId.isBlank()) {
            return Optional.empty();
        }
        return getEmployeeDetails(employeeId.trim(), null, null);
    }

    public Optional<HrmsEmployeeDto> fetchByHrmsId(String hrmsId) {
        if (hrmsId == null || hrmsId.isBlank()) {
            return Optional.empty();
        }
        return getEmployeeDetails(null, hrmsId.trim(), null);
    }

    public Optional<HrmsEmployeeDto> fetchByPhoneNo(String phoneNo) {
        if (phoneNo == null || phoneNo.isBlank()) {
            return Optional.empty();
        }
        String digits = phoneNo.replaceAll("\\D", "");
        if (digits.length() < 10) {
            return Optional.empty();
        }
        return getEmployeeDetails(null, null, digits);
    }

    private Optional<HrmsEmployeeDto> getEmployeeDetails(String employeeId, String hrmsId, String phoneNo) {
        String token = obtainAccessToken();
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        HttpEntity<Void> entity = new HttpEntity<>(headers);

        RestClientException lastError = null;
        for (String baseUrl : resolveEmployeeDetailUrls()) {
            UriComponentsBuilder uri = UriComponentsBuilder.fromUriString(baseUrl);
            if (employeeId != null && !employeeId.isBlank()) {
                uri.queryParam("employee_id", employeeId);
            }
            if (hrmsId != null && !hrmsId.isBlank()) {
                uri.queryParam("hrms_id", hrmsId);
            }
            if (phoneNo != null && !phoneNo.isBlank()) {
                uri.queryParam("phone_no", phoneNo);
            }
            uri.queryParam("status", "A");

            try {
                ResponseEntity<String> response = restTemplate.exchange(
                        uri.toUriString(),
                        HttpMethod.GET,
                        entity,
                        String.class);

                if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                    continue;
                }

                JsonNode root = objectMapper.readTree(response.getBody());
                if (!"Success".equalsIgnoreCase(root.path("result").asText())) {
                    log.debug("HRMS non-success at {} (employeeId={}, hrmsId={})", baseUrl, employeeId, hrmsId);
                    continue;
                }

                JsonNode data = root.path("data");
                if (data.isMissingNode() || data.isNull()) {
                    continue;
                }

                JsonNode item = data.isArray()
                        ? (data.isEmpty() ? null : data.get(0))
                        : data;
                if (item == null || item.isMissingNode() || item.isNull()) {
                    continue;
                }

                HrmsEmployeeDto dto = objectMapper.treeToValue(item, HrmsEmployeeDto.class);
                if (dto.getFullName() == null || dto.getFullName().isBlank()) {
                    continue;
                }
                return Optional.of(dto);
            } catch (RestClientException ex) {
                lastError = ex;
                if (ex.getMessage() != null && ex.getMessage().contains("404")) {
                    log.debug("HRMS path not found: {}", baseUrl);
                    continue;
                }
                log.warn("HRMS employee lookup failed at {} (employeeId={}, hrmsId={}): {}",
                        baseUrl, employeeId, hrmsId, ex.getMessage());
                return Optional.empty();
            } catch (Exception ex) {
                throw new ExternalApiException("Failed to parse HRMS employee response.", ex);
            }
        }

        if (lastError != null) {
            log.warn("HRMS employee lookup failed (employeeId={}, hrmsId={}): {}",
                    employeeId, hrmsId, lastError.getMessage());
        }
        return Optional.empty();
    }

    private List<String> resolveEmployeeDetailUrls() {
        Set<String> urls = new LinkedHashSet<>();
        urls.add(employeeDetailsUrl);
        if (employeeDetailsUrl.contains("/hrms/service/")) {
            urls.add(employeeDetailsUrl.replace("/hrms/service/", "/service/"));
        } else if (employeeDetailsUrl.contains("/service/")) {
            urls.add(employeeDetailsUrl.replace("/service/", "/hrms/service/"));
        }
        return new ArrayList<>(urls);
    }

    private synchronized String obtainAccessToken() {
        if (cachedAccessToken != null && Instant.now().isBefore(tokenExpiresAt.minusSeconds(15))) {
            return cachedAccessToken;
        }

        String basic = Base64.getEncoder().encodeToString(
                (clientId + ":" + clientSecret).getBytes(StandardCharsets.UTF_8));

        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.AUTHORIZATION, "Basic " + basic);
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "client_credentials");

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    tokenUrl,
                    HttpMethod.POST,
                    new HttpEntity<>(form, headers),
                    String.class);

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw new ExternalApiException("HRMS OAuth token request failed.");
            }

            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode tokenNode = root.path("access_token");
            String accessToken = tokenNode.isMissingNode() || tokenNode.isNull()
                    ? null : tokenNode.asText();
            if (accessToken == null || accessToken.isBlank()) {
                throw new ExternalApiException("HRMS OAuth response missing access_token.");
            }

            int expiresIn = root.path("expires_in").asInt(120);
            cachedAccessToken = accessToken;
            tokenExpiresAt = Instant.now().plusSeconds(Math.max(30, expiresIn));
            log.debug("HRMS OAuth token refreshed, expires in {}s", expiresIn);
            return cachedAccessToken;
        } catch (ExternalApiException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ExternalApiException("Could not connect to HRMS OAuth server.", ex);
        }
    }
}
