package com.medplus.frontdesk_backend.controller;

import com.medplus.frontdesk_backend.dto.ApiResponse;
import com.medplus.frontdesk_backend.dto.HrmsEmployeeLookupDto;
import com.medplus.frontdesk_backend.service.HrmsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;

/**
 * HRMS employee lookup — shared by User Management and Check-in (Add Employee).
 */
@RestController
@RequestMapping("/api/hrms")
@RequiredArgsConstructor
public class HrmsController {

    private final HrmsService hrmsService;

    /**
     * GET /api/hrms/employees?employeeId= | ?hrmsId= | ?phoneNo=
     * Fetches employee metadata from HRMS (OAuth). Pass exactly one query param.
     */
    @GetMapping("/employees")
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN', 'REGIONAL_ADMIN', 'RECEPTIONIST')")
    public ResponseEntity<ApiResponse<HrmsEmployeeLookupDto>> lookupEmployee(
            @RequestParam(required = false) String employeeId,
            @RequestParam(required = false) String hrmsId,
            @RequestParam(required = false) String phoneNo) {

        boolean hasEmployee = employeeId != null && !employeeId.isBlank();
        boolean hasHrms     = hrmsId != null && !hrmsId.isBlank();
        boolean hasPhone    = phoneNo != null && !phoneNo.isBlank();
        int paramCount = (hasEmployee ? 1 : 0) + (hasHrms ? 1 : 0) + (hasPhone ? 1 : 0);
        if (paramCount == 0) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("employeeId, hrmsId, or phoneNo is required."));
        }
        if (paramCount > 1) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Provide only one of employeeId, hrmsId, or phoneNo."));
        }

        Optional<HrmsEmployeeLookupDto> result = hasEmployee
                ? hrmsService.lookupEmployeeByEmployeeId(employeeId)
                : hasHrms
                    ? hrmsService.lookupEmployeeByHrmsId(hrmsId)
                    : hrmsService.lookupEmployeeByPhoneNo(phoneNo);

        String label = hasEmployee ? employeeId : hasHrms ? hrmsId : phoneNo;
        return result
                .map(dto -> ResponseEntity.ok(ApiResponse.success("Employee found in HRMS.", dto)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(ApiResponse.error("No employee found in HRMS for: " + label)));
    }
}
