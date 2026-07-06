package com.medplus.frontdesk_backend.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Optional first-time admin account. Disabled in production unless explicitly enabled.
 * Password is read from config, hashed at startup, and stored once (insert-if-absent).
 */
@Data
@ConfigurationProperties(prefix = "app.bootstrap.admin")
public class AdminBootstrapProperties {

    /** Create the admin row on startup when true. */
    private boolean enabled = false;

    private String employeeId = "ADMIN001";
    private String password = "";
    private String fullName = "System Administrator";
    private String email = "admin@medplus.com";
    private String phone = "";
    /** Optional; leave blank in config for a global admin with no fixed location. */
    private String location = "";
    private String locationName = "";
}
