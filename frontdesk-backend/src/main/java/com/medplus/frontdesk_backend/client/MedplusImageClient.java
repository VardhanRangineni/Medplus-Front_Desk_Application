package com.medplus.frontdesk_backend.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.medplus.frontdesk_backend.exception.ExternalApiException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Uploads visit-card PNGs via MedPlus image server (OAuth → transit → multipart upload).
 *
 * <p>Public browse URL = {@code imageServerUrl} from step 2 + {@code imagePath} from step 3, e.g.
 * {@code https://static1.medplusindia.com:666/displayprescriptionimages/static2/transit-images/.../LT_W_....png}
 */
@Slf4j
@Component
public class MedplusImageClient {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final MedplusOAuthTokenProvider oauth;

    @Value("${medplus.image.transit-url}")
    private String transitUrl;

    @Value("${medplus.image.origin}")
    private String origin;

    @Value("${medplus.image.transit-client-id}")
    private String transitClientId;

    @Value("${medplus.image.image-type}")
    private String imageType;

    public MedplusImageClient(RestTemplate restTemplate,
                              ObjectMapper objectMapper,
                              @Value("${medplus.image.oauth.token-url}") String tokenUrl,
                              @Value("${medplus.image.oauth.client-id}") String clientId,
                              @Value("${medplus.image.oauth.client-secret}") String clientSecret) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.oauth = new MedplusOAuthTokenProvider(
                restTemplate, objectMapper, tokenUrl, clientId, clientSecret, "MedplusImage");
    }

    /**
     * @return Public URL = step-2 {@code imageServerUrl} + step-3 {@code imagePath}.
     */
    public String uploadPng(byte[] pngBytes, String filename) {
        String bearer = oauth.getAccessToken();
        ImageServerSession session = resolveImageServer(bearer);

        String uploadUrl = UriComponentsBuilder
                .fromHttpUrl(session.imageServerUrl() + "/upload")
                .queryParam("token", session.uploadToken())
                .queryParam("clientId", session.uploadClientId())
                .queryParam("imageType", imageType)
                .build()
                .toUriString();

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("files", new ByteArrayResource(pngBytes) {
            @Override
            public String getFilename() {
                return filename != null ? filename : "MedPlus-VisitCard.png";
            }
        });

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    uploadUrl,
                    HttpMethod.POST,
                    new HttpEntity<>(body, headers),
                    String.class);

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw new ExternalApiException("Image upload failed with HTTP " + response.getStatusCode());
            }

            JsonNode root = objectMapper.readTree(response.getBody());
            if (!"SUCCESS".equalsIgnoreCase(root.path("statusCode").asText())) {
                throw new ExternalApiException("Image upload rejected: " + root.path("message").asText("unknown"));
            }

            JsonNode first = root.path("response").isArray() && !root.path("response").isEmpty()
                    ? root.path("response").get(0)
                    : null;
            if (first == null) {
                throw new ExternalApiException("Image upload response missing file entry");
            }

            String imagePath = first.path("imagePath").asText("").trim();
            if (imagePath.isBlank()) {
                throw new ExternalApiException("Image upload response missing imagePath");
            }

            String publicImageUrl = buildPublicUrl(session.imageServerUrl(), imagePath);
            log.info("[MedplusImage] Uploaded visit card imageUrl={}", publicImageUrl);
            return publicImageUrl;
        } catch (ExternalApiException ex) {
            throw ex;
        } catch (Exception ex) {
            log.error("[MedplusImage] Upload error: {}", ex.getMessage());
            throw new ExternalApiException("Image upload failed: " + ex.getMessage());
        }
    }

    private ImageServerSession resolveImageServer(String bearer) {
        String url = UriComponentsBuilder.fromHttpUrl(transitUrl)
                .queryParam("origin", origin)
                .queryParam("clientId", transitClientId)
                .build()
                .toUriString();

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(bearer);

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    String.class);

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw new ExternalApiException("Image server transit failed");
            }

            JsonNode root = objectMapper.readTree(response.getBody());
            if (!"SUCCESS".equalsIgnoreCase(root.path("statusCode").asText())) {
                throw new ExternalApiException("Image server transit rejected");
            }

            JsonNode session = root.path("response");
            String imageServerUrl = session.path("imageServerUrl").asText("").trim();
            String uploadToken = session.path("accessToken").asText("").trim();
            String uploadClientId = session.path("clientId").asText("").trim();
            if (imageServerUrl.isBlank() || uploadToken.isBlank() || uploadClientId.isBlank()) {
                throw new ExternalApiException("Image server transit response incomplete");
            }
            return new ImageServerSession(imageServerUrl, uploadToken, uploadClientId);
        } catch (ExternalApiException ex) {
            throw ex;
        } catch (Exception ex) {
            log.error("[MedplusImage] Transit error: {}", ex.getMessage());
            throw new ExternalApiException("Image server transit failed: " + ex.getMessage());
        }
    }

    /**
     * Combines step-2 {@code imageServerUrl} with step-3 {@code imagePath}.
     * Example: {@code https://static1.medplusindia.com:666} + {@code displayprescriptionimages/.../LT_W_....png}
     */
    static String buildPublicUrl(String imageServerUrl, String relativePath) {
        if (imageServerUrl == null || imageServerUrl.isBlank()) {
            throw new ExternalApiException("imageServerUrl is required to build public URL");
        }
        if (relativePath == null || relativePath.isBlank()) {
            throw new ExternalApiException("relative image path is required");
        }
        String base = imageServerUrl.endsWith("/")
                ? imageServerUrl.substring(0, imageServerUrl.length() - 1)
                : imageServerUrl;
        String path = relativePath.startsWith("/") ? relativePath.substring(1) : relativePath;
        return base + "/" + path;
    }

    private record ImageServerSession(String imageServerUrl, String uploadToken, String uploadClientId) {}
}
