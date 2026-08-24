package com.medplus.frontdesk_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Lightweight DTO returned when looking up past visitor records by mobile number.
 * Used by the "Known Visitor" flow to pre-fill check-in details and skip OTP.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KnownVisitorLookupDto {

    /** Display name of the visitor */
    private String name;

    /** Company name from the most recent visit (nullable) */
    private String companyName;

    /** Visitor ID card number from the most recent visit (nullable) */
    private Integer cardNumber;

    /** Reason for visit from the most recent visit (nullable) */
    private String reasonForVisit;

    /** Date-time of the most recent check-in */
    private String lastVisitDate;

    /** Total count of past check-ins at this location for this mobile */
    private Long totalVisits;
}
