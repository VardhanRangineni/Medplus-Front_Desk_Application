package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.model.Visitor;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Desk walk-in visit pass eligibility and initiation.
 */
@Service
@RequiredArgsConstructor
public class VisitPassService {

    private final PreRegistrationService preRegistrationService;
    private final VisitPassDeliveryExecutor deliveryExecutor;

    @Value("${app.visit-pass.enabled:true}")
    private boolean enabled;

    public boolean isEligible(Visitor visitor) {
        if (!enabled) return false;
        if (visitor.getEntryType() == null || visitor.getEntryType().name().equals("EMPLOYEE")) {
            return false;
        }
        return isValidIndianMobile(visitor.getMobile());
    }

    public String initiateDeskWalkInPass(Visitor visitor) {
        if (!isEligible(visitor)) {
            return null;
        }
        String token = preRegistrationService.createDeskCheckInPass(visitor);
        deliveryExecutor.deliverAsync(token, visitor.getName(), visitor.getMobile());
        return token;
    }

    public boolean resendForVisitor(String visitorId) {
        var row = preRegistrationService.findPassByVisitorId(visitorId);
        if (row == null) {
            return false;
        }
        String token = (String) row.get("token");
        String name = (String) row.get("name");
        String mobile = (String) row.get("mobile");
        if (token == null || mobile == null || !isValidIndianMobile(mobile)) {
            return false;
        }
        return deliveryExecutor.deliver(token, name, mobile);
    }

    /** Returns the preregistration token linked to a visitor log (desk walk-in or web self-reg). */
    public Optional<String> findPassTokenForVisitor(String visitorId) {
        var row = preRegistrationService.findPassByVisitorId(visitorId);
        if (row == null) {
            return Optional.empty();
        }
        Object token = row.get("token");
        if (token == null || token.toString().isBlank()) {
            return Optional.empty();
        }
        return Optional.of(token.toString().trim());
    }

    static boolean isValidIndianMobile(String mobile) {
        if (mobile == null) return false;
        String digits = mobile.replaceAll("\\D", "");
        return digits.matches("^[6-9]\\d{9}$");
    }
}
