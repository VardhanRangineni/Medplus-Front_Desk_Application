package com.medplus.frontdesk_backend.controller;

import com.medplus.frontdesk_backend.dto.*;
import com.medplus.frontdesk_backend.service.OtpService;
import com.medplus.frontdesk_backend.service.PreRegistrationService;
import com.medplus.frontdesk_backend.service.VisitorService;
import com.medplus.frontdesk_backend.util.WorkstationMacUtil;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.NoSuchElementException;

@Slf4j
@RestController
@RequestMapping("/api/pre-register")
@RequiredArgsConstructor
public class PreRegistrationController {

    private final PreRegistrationService preRegistrationService;
    private final VisitorService visitorService;
    private final OtpService otpService;

    // ── POST /api/pre-register/link ───────────────────────────────────────────
    // Authenticated — front-desk staff generates a group shareable link

    @PostMapping("/link")
    public ResponseEntity<ApiResponse<PreRegGroupLinkDto>> createGroupLink(
            @RequestBody Map<String, String> body,
            Authentication auth) {
        String locationId = body.get("locationId");
        if (locationId == null || locationId.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("locationId is required."));
        }
        try {
            PreRegGroupLinkDto result = preRegistrationService.createGroupLink(locationId, auth.getName());
            return ResponseEntity.ok(ApiResponse.success("Group link created.", result));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    // ── GET /api/pre-register/public/form-data/{groupToken} ───────────────────
    // PUBLIC — returns persons/departments for the public self-registration form

    @GetMapping("/public/form-data/{groupToken}")
    public ResponseEntity<ApiResponse<PreRegFormDataDto>> getFormData(
            @PathVariable String groupToken) {
        try {
            PreRegFormDataDto data = preRegistrationService.getFormData(groupToken);
            return ResponseEntity.ok(ApiResponse.success("Form data loaded.", data));
        } catch (NoSuchElementException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    // ── POST /api/pre-register/public/submit/{groupToken} ─────────────────────
    // PUBLIC — visitor submits their details; returns their unique QR token

    @PostMapping("/public/submit/{groupToken}")
    public ResponseEntity<ApiResponse<PreRegSubmitResponseDto>> submitRegistration(
            @PathVariable String groupToken,
            @RequestBody PreRegSubmitDto dto) {
        try {
            if (dto.getEntryType() == null || dto.getEntryType().isBlank()) {
                return ResponseEntity.badRequest().body(ApiResponse.error("Entry type is required."));
            }
            boolean isEmployee = "EMPLOYEE".equalsIgnoreCase(dto.getEntryType());
            if (!isEmployee && (dto.getName() == null || dto.getName().isBlank())) {
                return ResponseEntity.badRequest().body(ApiResponse.error("Name is required."));
            }
            if (isEmployee && (dto.getEmpId() == null || dto.getEmpId().isBlank())) {
                return ResponseEntity.badRequest().body(ApiResponse.error("Employee ID is required."));
            }
            PreRegSubmitResponseDto result = preRegistrationService.submitRegistration(groupToken, dto);
            return ResponseEntity.ok(ApiResponse.success("Registration submitted.", result));
        } catch (NoSuchElementException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    // ── GET /api/pre-register/public/confirm/{token} ──────────────────────────
    // PUBLIC — returns confirmation details after a visitor has submitted

    @GetMapping("/public/confirm/{token}")
    public ResponseEntity<ApiResponse<PreRegSubmitResponseDto>> getConfirmation(
            @PathVariable String token) {
        try {
            PreRegSubmitResponseDto result = preRegistrationService.getSubmission(token);
            return ResponseEntity.ok(ApiResponse.success("Confirmation retrieved.", result));
        } catch (NoSuchElementException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    // ── POST /api/pre-register/public/otp/send ────────────────────────────────
    // PUBLIC — send OTP to visitor mobile for self-registration form

    @PostMapping("/public/otp/send")
    public ResponseEntity<ApiResponse<OtpSendResponseDto>> sendPublicOtp(
            @Valid @RequestBody OtpSendRequestDto request) {
        OtpSendResponseDto response = otpService.sendOtp(request.getMobile());
        return ResponseEntity.ok(ApiResponse.success("OTP dispatch completed.", response));
    }

    // ── POST /api/pre-register/public/otp/verify ──────────────────────────────
    // PUBLIC — verify visitor mobile OTP for self-registration form

    @PostMapping("/public/otp/verify")
    public ResponseEntity<ApiResponse<OtpVerifyResponseDto>> verifyPublicOtp(
            @Valid @RequestBody OtpVerifyRequestDto request) {
        OtpVerifyResponseDto response = otpService.verifyOtp(request.getMobile(), request.getOtp());
        return ResponseEntity.ok(ApiResponse.success("OTP verification completed.", response));
    }

    // ── GET /api/pre-register/public/hrms-verify-phone?phone= ─────────────────
    // PUBLIC — verify person-to-meet by mobile for self check-in form

    @GetMapping("/public/hrms-verify-phone")
    public ResponseEntity<ApiResponse<PreRegHrmsVerifyDto>> verifyPersonToMeetByPhone(
            @RequestParam String phone) {
        try {
            PreRegHrmsVerifyDto result = preRegistrationService.verifyPersonToMeetByPhone(phone);
            if (result.isFound()) {
                return ResponseEntity.ok(ApiResponse.success("Employee found.", result));
            }
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error(result.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    // ── GET /api/pre-register/public/hrms-verify?id= ─────────────────────────
    // PUBLIC — verify Employee ID or HRMS ID for self check-in form

    @GetMapping("/public/hrms-verify")
    public ResponseEntity<ApiResponse<PreRegHrmsVerifyDto>> verifyHrmsForPublicForm(
            @RequestParam String id) {
        try {
            PreRegHrmsVerifyDto result = preRegistrationService.verifyEmployeeForPublicForm(id);
            if (result.isFound()) {
                return ResponseEntity.ok(ApiResponse.success("Employee found.", result));
            }
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error(result.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    // ── POST /api/pre-register/public/walk-in ─────────────────────────────────
    // PUBLIC — single public walk-in form, no location or group token required

    @PostMapping("/public/walk-in")
    public ResponseEntity<ApiResponse<PreRegSubmitResponseDto>> walkInSubmit(
            @RequestBody PreRegSubmitDto dto) {
        try {
            boolean isEmployee = "EMPLOYEE".equalsIgnoreCase(dto.getEntryType());
            if (!isEmployee && (dto.getName() == null || dto.getName().isBlank())) {
                return ResponseEntity.badRequest().body(ApiResponse.error("Name is required."));
            }
            if (isEmployee && (dto.getEmpId() == null || dto.getEmpId().isBlank())) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error("Employee ID or HRMS ID is required."));
            }
            if (isEmployee && !preRegistrationService.isEmployeeVerifiedInHrms(dto.getEmpId())) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error(
                                "Employee not found in HRMS. Please check your Employee ID or HRMS ID."));
            }
            if (dto.getReasonForVisit() == null || dto.getReasonForVisit().isBlank()) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error("Reason for visit is required."));
            }
            if (dto.getPersonToMeetId() == null || dto.getPersonToMeetId().isBlank()) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error("Person to meet is required."));
            }
            if ("__OTHER__".equals(dto.getPersonToMeetId())) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error(
                                "Person to meet must be verified via HRMS mobile lookup."));
            }
            PreRegSubmitResponseDto result = preRegistrationService.submitWalkIn(dto);
            return ResponseEntity.ok(ApiResponse.success("Registration submitted.", result));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    // ── GET /api/pre-register/public/loc/{locationId} ────────────────────────
    // PUBLIC — returns form data for a location (permanent, no expiry)

    @GetMapping("/public/loc/{locationId}")
    public ResponseEntity<ApiResponse<PreRegFormDataDto>> getFormDataByLocation(
            @PathVariable String locationId) {
        try {
            PreRegFormDataDto data = preRegistrationService.getFormDataByLocation(locationId);
            return ResponseEntity.ok(ApiResponse.success("Form data loaded.", data));
        } catch (NoSuchElementException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    // ── POST /api/pre-register/public/loc/{locationId}/submit ─────────────────
    // PUBLIC — visitor submits their details for a location (permanent, no expiry)

    @PostMapping("/public/loc/{locationId}/submit")
    public ResponseEntity<ApiResponse<PreRegSubmitResponseDto>> submitByLocation(
            @PathVariable String locationId,
            @RequestBody PreRegSubmitDto dto) {
        try {
            if (dto.getEntryType() == null || dto.getEntryType().isBlank()) {
                return ResponseEntity.badRequest().body(ApiResponse.error("Entry type is required."));
            }
            boolean isEmployee = "EMPLOYEE".equalsIgnoreCase(dto.getEntryType());
            if (!isEmployee && (dto.getName() == null || dto.getName().isBlank())) {
                return ResponseEntity.badRequest().body(ApiResponse.error("Name is required."));
            }
            if (isEmployee && (dto.getEmpId() == null || dto.getEmpId().isBlank())) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error("Employee ID or HRMS ID is required."));
            }
            if (isEmployee && !preRegistrationService.isEmployeeVerifiedInHrms(dto.getEmpId())) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error(
                                "Employee not found in HRMS. Please check your Employee ID or HRMS ID."));
            }
            if (dto.getReasonForVisit() == null || dto.getReasonForVisit().isBlank()) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error("Reason for visit is required."));
            }
            if (dto.getPersonToMeetId() == null || dto.getPersonToMeetId().isBlank()) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error("Person to meet is required."));
            }
            if ("__OTHER__".equals(dto.getPersonToMeetId())) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error(
                                "Person to meet must be verified via HRMS mobile lookup."));
            }
            PreRegSubmitResponseDto result = preRegistrationService.submitForLocation(locationId, dto);
            return ResponseEntity.ok(ApiResponse.success("Registration submitted.", result));
        } catch (NoSuchElementException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    // ── GET /api/pre-register/search-staff?q=...&token=... ────────────────────
    // Authenticated — search employees at the location tied to a pre-registration token

    @GetMapping("/search-staff")
    public ResponseEntity<ApiResponse<java.util.List<java.util.Map<String, Object>>>> searchStaff(
            @RequestParam String q,
            @RequestParam String token,
            Authentication auth) {
        if (q == null || q.trim().length() < 2) {
            return ResponseEntity.ok(ApiResponse.success("Query too short.", java.util.List.of()));
        }
        try {
            String callerEmpId = auth != null ? auth.getName() : null;
            var results = preRegistrationService.searchStaff(q.trim(), token, callerEmpId);
            return ResponseEntity.ok(ApiResponse.success("Search results.", results));
        } catch (NoSuchElementException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    // ── GET /api/pre-register/preview/{token} ─────────────────────────────────
    // Authenticated — returns visitor details + Aadhaar for staff review before accepting

    @GetMapping("/preview/{token}")
    public ResponseEntity<ApiResponse<PreRegPreviewDto>> previewQr(
            @PathVariable String token) {
        try {
            PreRegPreviewDto preview = preRegistrationService.getPreviewForQr(token);
            return ResponseEntity.ok(ApiResponse.success("Preview loaded.", preview));
        } catch (NoSuchElementException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    // ── POST /api/pre-register/checkin/{token} ────────────────────────────────
    // Authenticated — front-desk accepts the QR and completes check-in

    @PostMapping("/checkin/{token}")
    public ResponseEntity<ApiResponse<VisitorResponseDto>> checkInByQr(
            @PathVariable String token,
            @RequestBody Map<String, String> body,
            @RequestHeader(value = WorkstationMacUtil.HEADER_NAME, required = false) String workstationMac,
            Authentication auth) {
        try {
            // 1. Validate token and get pre-registration data
            Map<String, Object> reg = preRegistrationService.validateQrToken(token);

            // 2. resolvedPersonId is selected by front-desk staff from the search
            String resolvedPersonId   = body != null ? body.get("resolvedPersonId")   : null;
            String resolvedPersonName = body != null ? body.get("resolvedPersonName") : null;
            if (resolvedPersonId == null || resolvedPersonId.isBlank()) {
                return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Please select a person to meet before checking in."));
            }
            if ("__OTHER__".equals(resolvedPersonId)) {
                return ResponseEntity.badRequest()
                    .body(ApiResponse.error(
                            "Person to meet must be verified via HRMS mobile lookup."));
            }

            if ("EMPLOYEE".equals(reg.get("entryType"))) {
                String empId = reg.get("empId") != null ? reg.get("empId").toString() : null;
                if (empId == null || empId.isBlank()
                        || !preRegistrationService.isEmployeeVerifiedInHrms(empId)) {
                    return ResponseEntity.badRequest()
                            .body(ApiResponse.error(
                                    "Employee not found in HRMS. Check-in is not permitted."));
                }
            }

            // 3. Build check-in request
            VisitorRequestDto req = new VisitorRequestDto();
            req.setEntryType((String) reg.get("entryType"));
            req.setName((String) reg.get("name"));
            req.setMobile((String) reg.get("mobile"));
            req.setEmpId((String) reg.get("empId"));
            req.setPersonToMeetId(resolvedPersonId);
            req.setReasonForVisit((String) reg.get("reasonForVisit"));
            req.setGovtIdType((String) reg.get("govtIdType"));
            req.setGovtIdNumber((String) reg.get("govtIdNumber"));
            req.setCompanyName((String) reg.get("companyName"));

            String cardRaw = body != null ? body.get("cardNumber") : null;
            if (cardRaw != null && !cardRaw.isBlank()) {
                try {
                    req.setCardNumber(Integer.parseInt(cardRaw.trim()));
                } catch (NumberFormatException ignored) {
                    return ResponseEntity.badRequest()
                            .body(ApiResponse.error("Invalid card number."));
                }
            }

            // 4. Create the visitor log entry (reuse existing QR — no duplicate visit-pass SMS)
            VisitorResponseDto created = visitorService.checkIn(req, auth.getName(), workstationMac, token);

            // 5. Mark pre-registration as used
            preRegistrationService.markCheckedIn(token, created.getId());

            return ResponseEntity.ok(ApiResponse.success("QR check-in successful.", created));
        } catch (NoSuchElementException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }
}
