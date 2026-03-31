package com.medplus.frontdesk_backend.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Registers a static resource handler so that saved visitor photos
 * are accessible via HTTP at /images/visitors/**.
 *
 * Files are read from {@code app.image.storage-path} on the server file system.
 * The path is resolved to an absolute path so it works correctly on all OS.
 *
 * TODO: remove this handler when photos are served from cloud storage —
 *       at that point the URLs returned by ImageStorageService will point
 *       directly to the storage bucket and no local serving is needed.
 */
@Slf4j
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Value("${app.image.storage-path:./images/visitors}")
    private String storagePath;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        Path absolutePath = Paths.get(storagePath).toAbsolutePath().normalize();
        // file: URI needs forward slashes on all platforms; on Windows an extra / prefix is required.
        String location = "file:///" + absolutePath.toString().replace("\\", "/") + "/";

        log.info("Serving visitor images from: {} → {}", absolutePath, location);

        registry.addResourceHandler("/images/visitors/**")
                .addResourceLocations(location);
    }
}
