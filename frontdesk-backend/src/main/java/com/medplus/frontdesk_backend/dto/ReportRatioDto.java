package com.medplus.frontdesk_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Aggregate counts for the Visitor-vs-Employee ratio donut chart.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReportRatioDto {

    /** External visitors (entryType = VISITOR). */
    private long visitorCount;

    /** Internal employees (entryType = EMPLOYEE). */
    private long employeeCount;

    /** Grand total (visitorCount + employeeCount). */
    private long totalCount;
}
