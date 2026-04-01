package com.medplus.frontdesk_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * A single hourly bucket returned by the dashboard visitor-flow chart.
 * {@code label} is a human-readable time string, e.g. "9am", "2pm".
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VisitorFlowPointDto {

    /** Human-readable hour label — e.g. "8am", "12pm", "3pm". */
    private String label;

    /** Total entries (visitors + employees) that checked in during this hour. */
    private long all;

    /** Employee check-ins during this hour. */
    private long employee;

    /** Non-employee (visitor) check-ins during this hour. */
    private long nonEmployee;
}
