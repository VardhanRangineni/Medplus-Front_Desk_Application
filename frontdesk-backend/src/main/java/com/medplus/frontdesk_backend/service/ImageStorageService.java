package com.medplus.frontdesk_backend.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Base64;
import java.util.UUID;

/**
 * Handles saving visitor photos to local disk and returning a URL.
 *
 * Current setup: images are written to {@code app.image.storage-path} (default: ./images/visitors)
 * and served by Spring's static resource handler at /images/visitors/**.
 *
 * TODO: when moving to cloud storage (S3 / Azure Blob / GCS), replace the body of
 *       {@link #saveImage(String)} with an SDK upload call and update
 *       {@code app.image.base-url} in application.properties to point to the bucket URL.
 */
@Slf4j
@Service
public class ImageStorageService {

    /**
     * File system path where visitor photos are stored.
     * Default: ./images/visitors (relative to the application working directory).
     * Override via application.properties: app.image.storage-path=./images/visitors
     */
    @Value("${app.image.storage-path:./images/visitors}")
    private String storagePath;

    /**
     * Base URL prepended to the filename when constructing the public image URL.
     * Currently points to the local Spring Boot server.
     * TODO: swap to cloud storage base URL when storage migration is done,
     *       e.g. https://storage.medplus.com/visitors
     */
    @Value("${app.image.base-url:http://localhost:8080/images/visitors}")
    private String baseUrl;

    /**
     * Decodes a base64-encoded image (with or without data-URI prefix),
     * writes it to the local images folder, and returns the public URL.
     *
     * @param base64Data  base64 string — e.g. "data:image/jpeg;base64,/9j/..." or plain base64
     * @return            public URL to access the saved image
     * @throws IOException if the file cannot be written
     */
    public String saveImage(String base64Data) throws IOException {
        String raw = base64Data.contains(",")
                ? base64Data.substring(base64Data.indexOf(',') + 1)
                : base64Data;

        byte[] bytes = Base64.getDecoder().decode(raw.trim());

        Path dir = Paths.get(storagePath);
        Files.createDirectories(dir);

        String filename = System.currentTimeMillis() + "_" + UUID.randomUUID().toString().replace("-", "") + ".jpg";
        Path filePath = dir.resolve(filename);
        Files.write(filePath, bytes);

        log.info("Visitor photo saved: {}", filePath.toAbsolutePath());

        // TODO: replace this with a cloud storage upload and return the cloud URL
        return baseUrl.stripTrailing() + "/" + filename;
    }
}
