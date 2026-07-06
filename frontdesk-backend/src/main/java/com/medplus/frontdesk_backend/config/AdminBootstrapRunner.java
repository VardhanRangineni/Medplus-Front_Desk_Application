package com.medplus.frontdesk_backend.config;

import com.medplus.frontdesk_backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Ensures one primary-admin login exists when configured in {@code application.properties}.
 * Runs after {@code schema-init.sql} on startup.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AdminBootstrapRunner implements ApplicationRunner {

    private static final int ROLE_PRIMARY_ADMIN = 1;

    private final AdminBootstrapProperties  properties;
    private final JdbcTemplate            jdbc;
    private final BCryptPasswordEncoder   passwordEncoder;
    private final UserRepository          userRepository;

    @Override
    public void run(ApplicationArguments args) {
        if (!properties.isEnabled()) {
            return;
        }

        String employeeId = trim(properties.getEmployeeId());
        String password   = properties.getPassword();

        if (employeeId.isEmpty()) {
            log.warn("app.bootstrap.admin.enabled=true but employee-id is empty — skipped");
            return;
        }
        if (password == null || password.isBlank()) {
            log.warn("app.bootstrap.admin.enabled=true but password is empty — skipped");
            return;
        }

        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM usermanagement WHERE employeeid = ?",
                Integer.class, employeeId);
        if (count != null && count > 0) {
            log.debug("Bootstrap admin {} already exists — skipped", employeeId);
            return;
        }

        String hash = passwordEncoder.encode(password);
        jdbc.update("""
                INSERT INTO usermanagement
                    (employeeid, fullName, workemail, phone, designation, department,
                     password, location, locationName, loginEnabled, status, roleId, createdBy)
                VALUES (?, ?, ?, ?, 'Administrator', 'Administration',
                        ?, ?, ?, 1, 'ACTIVE', ?, 'BOOTSTRAP')
                """,
                employeeId,
                trim(properties.getFullName()),
                trim(properties.getEmail()),
                trim(properties.getPhone()),
                hash,
                trim(properties.getLocation()),
                trim(properties.getLocationName()),
                ROLE_PRIMARY_ADMIN);

        userRepository.replaceUserRoles(employeeId, List.of(ROLE_PRIMARY_ADMIN));

        log.info("Bootstrap admin created: {} ({})", employeeId, properties.getFullName());
    }

    private static String trim(String value) {
        return value != null ? value.trim() : "";
    }
}
