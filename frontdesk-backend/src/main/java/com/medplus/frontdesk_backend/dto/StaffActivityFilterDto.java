package com.medplus.frontdesk_backend.dto;

import lombok.Builder;
import lombok.Data;

/**
 * Column-level filters for staff activity report (all optional, combined with AND).
 */
@Data
@Builder
public class StaffActivityFilterDto {

    /** Staff name or employee ID (recorded by). */
    private String staffQuery;
    private String visitorName;
    /** Matches mobile (visitors) or employee ID (employees). */
    private String contactQuery;
    private String entryType;
    private String department;
    private String personToMeet;
    /** checked-in | checked-out */
    private String status;
    private String cardNumber;
    private String workstationMac;

    public boolean hasAnyFilter() {
        return isSet(staffQuery) || isSet(visitorName) || isSet(contactQuery) || isSet(entryType)
                || isSet(department) || isSet(personToMeet) || isSet(status)
                || isSet(cardNumber) || isSet(workstationMac);
    }

    private static boolean isSet(String v) {
        return v != null && !v.isBlank();
    }
}
