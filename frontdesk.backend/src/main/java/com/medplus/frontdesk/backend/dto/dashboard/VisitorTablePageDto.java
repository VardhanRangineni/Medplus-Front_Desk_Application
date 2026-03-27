package com.medplus.frontdesk.backend.dto.dashboard;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Paginated response for the dashboard visitors table.
 *
 * Query params that drive this payload:
 *   locationId   – filter by location (admin only; omit for user-scoped calls)
 *   visitorType  – ALL | EMPLOYEE | NONEMPLOYEE
 *   status       – ALL | CheckedIn | CheckedOut
 *   fromDate     – ISO date (inclusive)
 *   toDate       – ISO date (inclusive)
 *   page         – 0-based page index (default 0)
 *   pageSize     – rows per page (default 10, max 50)
 *   search       – optional free-text search on fullName or identificationNumber
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class VisitorTablePageDto {

    private List<RecentVisitorDto> rows;

    /** 0-based page index that was applied. */
    private int page;

    /** Number of rows requested per page. */
    private int pageSize;

    /** Total matching rows across all pages. */
    private int totalRows;

    /** Total number of pages ( ceil(totalRows / pageSize) ). */
    private int totalPages;

    /** Filters that were actually applied (for the UI to reflect). */
    private String appliedLocationId;
    private String appliedVisitorType;
    private String appliedStatus;
}
