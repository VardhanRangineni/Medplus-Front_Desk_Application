package com.medplus.frontdesk_backend.controller;

import com.medplus.frontdesk_backend.dto.ApiResponse;
import com.medplus.frontdesk_backend.dto.AppointmentBookingRequestDto;
import com.medplus.frontdesk_backend.dto.AppointmentConfirmationDto;
import com.medplus.frontdesk_backend.dto.AppointmentSlotDto;
import com.medplus.frontdesk_backend.dto.EmployeeLookupResponseDto;
import com.medplus.frontdesk_backend.dto.OtpSendResponseDto;
import com.medplus.frontdesk_backend.dto.OtpVerifyResponseDto;
import com.medplus.frontdesk_backend.dto.PersonToMeetDto;
import com.medplus.frontdesk_backend.model.Location;
import com.medplus.frontdesk_backend.service.AppointmentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

/**
 * AppointmentBookingController — all endpoints under /api/appointment/public/** are
 * publicly accessible (no JWT required).  They power the standalone appointment
 * booking web application consumed by Visitors and Employees.
 *
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │  VISITOR FLOW                                                             │
 * │  1. POST /otp/send          – request OTP to mobile                      │
 * │  2. POST /otp/verify        – verify OTP → proceed to details form       │
 * │  3. GET  /employees?q=      – type-ahead search for person to meet       │
 * │  4. GET  /slots?date=&personId= – fetch available time slots             │
 * │  5. POST /book              – submit booking → receive token             │
 * │  6. GET  /confirm/{token}   – poll / display confirmation                │
 * │                                                                           │
 * │  EMPLOYEE FLOW                                                            │
 * │  1. POST /employee/lookup   – look up employee, dispatch OTP to phone    │
 * │  2. POST /employee/otp/verify – verify OTP                               │
 * │  3. GET  /employees?q=      – same search endpoint                       │
 * │  4. GET  /slots?date=&personId= – same slots endpoint                    │
 * │  5. POST /book              – same booking endpoint                      │
 * │  6. GET  /confirm/{token}   – same confirmation endpoint                 │
 * └───────────────────────────────────────────────────────────────────────────┘
 */
@Slf4j
@RestController
@RequestMapping("/api/appointment/public")
@RequiredArgsConstructor
public class AppointmentBookingController {

    private final AppointmentService appointmentService;

    // ── Visitor OTP ───────────────────────────────────────────────────────────

    /**
     * Sends a 6-digit OTP to the visitor's mobile number.
     *
     * <pre>
     * POST /api/appointment/public/otp/send
     * Content-Type: application/json
     *
     * { "mobile": "9876543210" }
     * </pre>
     *
     * Success (200):
     * <pre>{ "success": true, "data": { "success": true, "message": "OTP sent successfully." } }</pre>
     */
    @PostMapping("/otp/send")
    public ResponseEntity<ApiResponse<OtpSendResponseDto>> sendVisitorOtp(
            @RequestBody Map<String, String> body) {

        String mobile = body.getOrDefault("mobile", "").trim();
        if (!mobile.matches("^[6-9]\\d{9}$")) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("mobile must be a valid 10-digit Indian mobile number"));
        }
        OtpSendResponseDto result = appointmentService.sendVisitorOtp(mobile);
        return ResponseEntity.ok(ApiResponse.success("OTP dispatch completed.", result));
    }

    /**
     * Verifies the OTP entered by the visitor.
     *
     * <pre>
     * POST /api/appointment/public/otp/verify
     * Content-Type: application/json
     *
     * { "mobile": "9876543210", "otp": "483921" }
     * </pre>
     *
     * Success (200):
     * <pre>{ "success": true, "data": { "verified": true, "message": "Mobile number verified successfully." } }</pre>
     */
    @PostMapping("/otp/verify")
    public ResponseEntity<ApiResponse<OtpVerifyResponseDto>> verifyVisitorOtp(
            @RequestBody Map<String, String> body) {

        String mobile = body.getOrDefault("mobile", "").trim();
        String otp    = body.getOrDefault("otp", "").trim();

        if (mobile.isBlank() || otp.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("mobile and otp are required"));
        }
        OtpVerifyResponseDto result = appointmentService.verifyVisitorOtp(mobile, otp);
        return ResponseEntity.ok(ApiResponse.success("OTP verification completed.", result));
    }

    // ── Employee lookup + OTP ─────────────────────────────────────────────────

    /**
     * Looks up an employee by ID and dispatches an OTP to their registered phone.
     *
     * <pre>
     * POST /api/appointment/public/employee/lookup
     * Content-Type: application/json
     *
     * { "empId": "EMP001" }
     * </pre>
     *
     * Success (200):
     * <pre>{
     *   "success": true,
     *   "data": {
     *     "found": true,
     *     "employee": { "id": "EMP001", "name": "Jane Doe",
     *                   "department": "Cardiology", "maskedPhone": "98****10" }
     *   }
     * }</pre>
     *
     * Not found (404):
     * <pre>{ "success": false, "message": "Employee ID not found." }</pre>
     */
    @PostMapping("/employee/lookup")
    public ResponseEntity<ApiResponse<EmployeeLookupResponseDto>> lookupEmployee(
            @RequestBody Map<String, String> body) {

        String empId = body.getOrDefault("empId", "").trim();
        if (empId.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("empId is required"));
        }
        try {
            EmployeeLookupResponseDto result = appointmentService.lookupEmployeeAndSendOtp(empId);
            return ResponseEntity.ok(ApiResponse.success("Employee found. OTP sent.", result));
        } catch (org.springframework.web.server.ResponseStatusException ex) {
            return ResponseEntity.status(ex.getStatusCode())
                    .body(ApiResponse.error(ex.getReason()));
        }
    }

    /**
     * Verifies the OTP entered by an employee.
     *
     * <pre>
     * POST /api/appointment/public/employee/otp/verify
     * Content-Type: application/json
     *
     * { "empId": "EMP001", "otp": "483921" }
     * </pre>
     */
    @PostMapping("/employee/otp/verify")
    public ResponseEntity<ApiResponse<OtpVerifyResponseDto>> verifyEmployeeOtp(
            @RequestBody Map<String, String> body) {

        String empId = body.getOrDefault("empId", "").trim();
        String otp   = body.getOrDefault("otp", "").trim();

        if (empId.isBlank() || otp.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("empId and otp are required"));
        }
        try {
            OtpVerifyResponseDto result = appointmentService.verifyEmployeeOtp(empId, otp);
            return ResponseEntity.ok(ApiResponse.success("OTP verification completed.", result));
        } catch (org.springframework.web.server.ResponseStatusException ex) {
            return ResponseEntity.status(ex.getStatusCode())
                    .body(ApiResponse.error(ex.getReason()));
        }
    }

    // ── Office locations ──────────────────────────────────────────────────────

    /**
     * Returns all active office locations from locationmaster.
     * Used to populate the "Office Location" dropdown on the booking form.
     *
     * <pre>
     * GET /api/appointment/public/locations
     * </pre>
     *
     * Success (200):
     * <pre>[
     *   { "locationId": "LOC001", "descriptiveName": "Main Campus",
     *     "city": "Mumbai", "state": "Maharashtra" },
     *   ...
     * ]</pre>
     */
    @GetMapping("/locations")
    public ResponseEntity<ApiResponse<List<Location>>> getLocations() {
        List<Location> locations = appointmentService.getLocations();
        return ResponseEntity.ok(ApiResponse.success("Locations loaded.", locations));
    }

    // ── Employee search ───────────────────────────────────────────────────────

    /**
     * Type-ahead search for the "Person to Meet" autocomplete field.
     * Returns up to 20 matching employees ordered by name.
     * Query must be at least 2 characters.
     *
     * <pre>
     * GET /api/appointment/public/employees?q=john
     * </pre>
     *
     * Success (200):
     * <pre>[
     *   { "id": "EMP001", "name": "John Smith",
     *     "department": "Cardiology", "designation": "Senior Consultant" },
     *   ...
     * ]</pre>
     */
    @GetMapping("/employees")
    public ResponseEntity<ApiResponse<List<PersonToMeetDto>>> searchEmployees(
            @RequestParam(value = "q",          defaultValue = "")    String query,
            @RequestParam(value = "locationId", required    = false)  String locationId) {

        if (query.trim().length() < 2) {
            return ResponseEntity.ok(ApiResponse.success("Query too short.", List.of()));
        }
        List<PersonToMeetDto> results = appointmentService.searchEmployees(query, locationId);
        results.forEach(p -> p.setPhone(null));
        return ResponseEntity.ok(ApiResponse.success("Search results.", results));
    }

    // ── Time slots ────────────────────────────────────────────────────────────

    /**
     * Returns the daily time-slot grid for a given date and person-to-meet.
     * Slots already booked are marked {@code available: false}.
     *
     * <pre>
     * GET /api/appointment/public/slots?date=2024-07-22&personId=EMP001
     * </pre>
     *
     * Success (200):
     * <pre>[
     *   { "time": "09:00 AM", "value": "09:00", "available": true  },
     *   { "time": "09:30 AM", "value": "09:30", "available": false },
     *   ...
     * ]</pre>
     */
    @GetMapping("/slots")
    public ResponseEntity<ApiResponse<List<AppointmentSlotDto>>> getSlots(
            @RequestParam String date,
            @RequestParam String personId) {

        if (date == null || date.isBlank() || personId == null || personId.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("date and personId are required"));
        }
        try {
            List<AppointmentSlotDto> slots = appointmentService.getAvailableSlots(date, personId);
            return ResponseEntity.ok(ApiResponse.success("Slots loaded.", slots));
        } catch (org.springframework.web.server.ResponseStatusException ex) {
            return ResponseEntity.status(ex.getStatusCode())
                    .body(ApiResponse.error(ex.getReason()));
        }
    }

    // ── Booking ───────────────────────────────────────────────────────────────

    /**
     * Submits the appointment booking and returns a confirmation record
     * containing a token and human-readable booking reference.
     *
     * <pre>
     * POST /api/appointment/public/book
     * Content-Type: application/json
     *
     * {
     *   "entryType":       "VISITOR",
     *   "name":            "Rahul Sharma",
     *   "mobile":          "9876543210",
     *   "email":           "rahul@example.com",
     *   "aadhaarNumber":   "123456789012",
     *   "personToMeetId":  "EMP001",
     *   "reasonForVisit":  "Annual health check",
     *   "appointmentDate": "2024-07-22",
     *   "appointmentTime": "10:00 AM"
     * }
     * </pre>
     *
     * Success (200):
     * <pre>{
     *   "success": true,
     *   "data": {
     *     "bookingToken": "uuid-here",
     *     "bookingReference": "APT-20240722-0001",
     *     "status": "PENDING",
     *     ...
     *   }
     * }</pre>
     */
    @PostMapping("/book")
    public ResponseEntity<ApiResponse<AppointmentConfirmationDto>> bookAppointment(
            @Valid @RequestBody AppointmentBookingRequestDto request) {

        try {
            AppointmentConfirmationDto confirmation = appointmentService.bookAppointment(request);
            return ResponseEntity.ok(ApiResponse.success("Appointment booked successfully.", confirmation));
        } catch (org.springframework.web.server.ResponseStatusException ex) {
            return ResponseEntity.status(ex.getStatusCode())
                    .body(ApiResponse.error(ex.getReason()));
        }
    }

    // ── Confirmation ──────────────────────────────────────────────────────────

    /**
     * Returns the booking confirmation for a given token.
     * Used by the confirmation screen to reload details on page refresh.
     *
     * <pre>
     * GET /api/appointment/public/confirm/{token}
     * </pre>
     *
     * Not found (400):
     * <pre>{ "success": false, "message": "Booking not found for token: ..." }</pre>
     */
    @GetMapping("/confirm/{token}")
    public ResponseEntity<ApiResponse<AppointmentConfirmationDto>> getConfirmation(
            @PathVariable String token) {

        try {
            AppointmentConfirmationDto confirmation = appointmentService.getConfirmation(token);
            return ResponseEntity.ok(ApiResponse.success("Confirmation retrieved.", confirmation));
        } catch (NoSuchElementException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }
}
