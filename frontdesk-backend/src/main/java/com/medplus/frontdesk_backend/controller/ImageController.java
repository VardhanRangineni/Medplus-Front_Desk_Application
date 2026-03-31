package com.medplus.frontdesk_backend.controller;

import com.medplus.frontdesk_backend.dto.ApiResponse;
import com.medplus.frontdesk_backend.service.ImageStorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.Map;

/**
 * Handles visitor photo uploads.
 *
 * POST /api/images/upload
 *   Request body:  { "imageData": "data:image/jpeg;base64,/9j/..." }
 *   Response body: { "data": { "imageUrl": "http://localhost:8080/images/visitors/xyz.jpg" } }
 *
 * The returned imageUrl should be included in the subsequent visitor create/update request
 * as the "imageUrl" field, so it gets persisted to visitorlog.
 *
 * TODO: when cloud storage is ready, ImageStorageService will upload to the bucket and
 *       the returned URL will point to the cloud rather than the local server.
 */
@Slf4j
@RestController
@RequestMapping("/api/images")
@RequiredArgsConstructor
public class ImageController {

    private final ImageStorageService imageStorageService;

    @PostMapping("/upload")
    public ResponseEntity<ApiResponse<Map<String, String>>> uploadImage(
            @RequestBody Map<String, String> body) {

        String imageData = body.get("imageData");
        if (imageData == null || imageData.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "imageData is required (base64-encoded JPEG, with or without data-URI prefix).");
        }

        try {
            String imageUrl = imageStorageService.saveImage(imageData);
            log.info("Image uploaded successfully: {}", imageUrl);
            return ResponseEntity.ok(
                    ApiResponse.success("Image uploaded successfully.", Map.of("imageUrl", imageUrl)));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid image data: " + e.getMessage());
        } catch (IOException e) {
            log.error("Failed to save image: {}", e.getMessage(), e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to save image. Please try again.");
        }
    }
}
