package com.medplus.frontdesk_backend;

import com.medplus.frontdesk_backend.dto.VisitorRequestDto;
import com.medplus.frontdesk_backend.dto.VisitorResponseDto;
import com.medplus.frontdesk_backend.model.OtpToken;
import com.medplus.frontdesk_backend.repository.OtpTokenRepository;
import com.medplus.frontdesk_backend.scheduler.OtpCleanupScheduler;
import com.medplus.frontdesk_backend.service.VisitorService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class VisitorConcurrencyAndOtpTests {

    @Autowired
    private VisitorService visitorService;

    @Autowired
    private OtpTokenRepository otpTokenRepository;

    @Autowired
    private OtpCleanupScheduler otpCleanupScheduler;

    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void setUp() {
        // Ensure test data exists in usermanagement & state/city/location master
        jdbc.execute("INSERT IGNORE INTO state_master (stateCode, stateName, createdBy) VALUES ('TG', 'Telangana', 'TEST')");
        jdbc.execute("INSERT IGNORE INTO city_master (cityCode, cityName, stateCode, createdBy) VALUES ('HYD', 'Hyderabad', 'TG', 'TEST')");
        jdbc.execute("INSERT IGNORE INTO company_master (companyCode, companyName, createdBy) VALUES ('MED', 'MedPlus', 'TEST')");
        jdbc.execute("INSERT IGNORE INTO location_type_master (typeCode, typeName, createdBy) VALUES ('HO', 'Head Office', 'TEST')");
        
        jdbc.execute("""
            INSERT IGNORE INTO location_master 
                (locationId, companyId, locationTypeId, stateCode, cityCode, address, descriptiveName, sequenceNum, status, createdBy)
            VALUES 
                ('MED-HO-00001', 
                 (SELECT id FROM company_master WHERE companyCode='MED' LIMIT 1),
                 (SELECT id FROM location_type_master WHERE typeCode='HO' LIMIT 1),
                 'TG', 'HYD', 'Madhapur', 'Medplus Head Office Hyderabad', 1, 'ACTIVE', 'TEST')
            """);

        jdbc.execute("""
            INSERT IGNORE INTO usermanagement 
                (employeeid, fullName, workemail, phone, designation, department, password, location, locationName, status, roleId, createdBy)
            VALUES 
                ('OTG001', 'Test Admin', 'admin@medplus.com', '9876543210', 'Admin', 'IT', 'password', 'MED-HO-00001', 'Medplus Head Office Hyderabad', 'ACTIVE', 1, 'TEST')
            """);
    }

    @Test
    void testConcurrentCheckInsProduceUniqueVisitorIds() throws Exception {
        int threads = 10;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch latch = new CountDownLatch(1);
        List<Future<VisitorResponseDto>> futures = new ArrayList<>();

        for (int i = 0; i < threads; i++) {
            final int index = i;
            futures.add(executor.submit(() -> {
                latch.await(); // wait for start signal
                
                // Propagate security context for the worker thread
                var context = org.springframework.security.core.context.SecurityContextHolder.createEmptyContext();
                var auth = new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                        "OTG001", null,
                        org.springframework.security.core.authority.AuthorityUtils.createAuthorityList("ROLE_RECEPTIONIST")
                );
                context.setAuthentication(auth);
                org.springframework.security.core.context.SecurityContextHolder.setContext(context);

                try {
                    VisitorRequestDto req = new VisitorRequestDto();
                    req.setEntryType("VISITOR");
                    req.setName("Concurrent Visitor " + index);
                    req.setMobile("90000000" + String.format("%02d", index));
                    req.setPersonToMeetId("OTG001");
                    req.setReasonForVisit("Test Concurrency");
                    req.setVisitType("INDIVIDUAL");
                    return visitorService.checkIn(req, "OTG001", "00:11:22:33:44:55");
                } finally {
                    org.springframework.security.core.context.SecurityContextHolder.clearContext();
                }
            }));
        }

        latch.countDown(); // trigger concurrent starts
        List<String> visitorIds = Collections.synchronizedList(new ArrayList<>());
        for (Future<VisitorResponseDto> future : futures) {
            try {
                VisitorResponseDto res = future.get();
                assertNotNull(res);
                assertNotNull(res.getId());
                visitorIds.add(res.getId());
            } catch (Exception e) {
                fail("Concurrent check-in failed: " + e.getMessage());
            }
        }
        executor.shutdown();

        // Verify all generated IDs are unique
        long uniqueCount = visitorIds.stream().distinct().count();
        assertEquals(threads, uniqueCount, "Visitor IDs generated concurrently must be unique!");
    }

    @Test
    void testOtpTokenPersistenceExpiryAndCleanup() {
        String activeMobile = "9999999999";
        String expiredMobile = "8888888888";
        LocalDateTime now = LocalDateTime.now(ZoneId.of("Asia/Kolkata"));

        // Save active token
        OtpToken activeToken = OtpToken.builder()
                .mobileNumber(activeMobile)
                .token("active-bearer-token")
                .createdAt(now)
                .expiresAt(now.plusMinutes(10))
                .build();
        otpTokenRepository.save(activeToken);

        // Save expired token (expires 5 minutes ago)
        OtpToken expiredToken = OtpToken.builder()
                .mobileNumber(expiredMobile)
                .token("expired-bearer-token")
                .createdAt(now.minusMinutes(10))
                .expiresAt(now.minusMinutes(5))
                .build();
        otpTokenRepository.save(expiredToken);

        // Assert they are saved
        Optional<OtpToken> activeResult = otpTokenRepository.findByMobileNumber(activeMobile);
        assertTrue(activeResult.isPresent());
        assertEquals("active-bearer-token", activeResult.get().getToken());

        Optional<OtpToken> expiredResult = otpTokenRepository.findByMobileNumber(expiredMobile);
        assertTrue(expiredResult.isPresent());
        assertEquals("expired-bearer-token", expiredResult.get().getToken());

        // Run cleanup scheduler
        otpCleanupScheduler.cleanupExpiredTokens();

        // Expired token should be deleted from DB
        Optional<OtpToken> expiredAfterCleanup = otpTokenRepository.findByMobileNumber(expiredMobile);
        assertFalse(expiredAfterCleanup.isPresent(), "Expired OTP token should be deleted by the cleanup job");

        // Active token should still be present
        Optional<OtpToken> activeAfterCleanup = otpTokenRepository.findByMobileNumber(activeMobile);
        assertTrue(activeAfterCleanup.isPresent(), "Active OTP token should not be deleted by the cleanup job");

        // Cleanup active token
        otpTokenRepository.deleteByMobileNumber(activeMobile);
    }
}
