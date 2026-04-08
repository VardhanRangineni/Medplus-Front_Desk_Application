package com.medplus.frontdesk_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One row of the department-wise visit summary report.
 * Returned as a list ordered by visitCount descending.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReportDeptSummaryDto {

    /** Department name (from visitorlog.department). */
    private String department;

    /** Total check-in count for the requested date range. */
    private long visitCount;
}
