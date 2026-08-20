package com.medplus.frontdesk_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Person (visitor or employee) with {@code minVisits}+ check-ins in the date range.
 * Ordered by visitCount descending.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReportFrequentVisitorDto {

    /** VISITOR or EMPLOYEE */
    private String entryType;

    private String name;

    /** Visitor mobile (null for employees when only empId is set). */
    private String mobile;

    /** Employee HRMS id (null for visitors). */
    private String empId;

    private long visitCount;

    /** Most recent check-in (ISO-ish DATE_FORMAT string). */
    private String lastVisit;

    /** Distinct departments visited in the range, comma-separated. */
    private String departments;
}
