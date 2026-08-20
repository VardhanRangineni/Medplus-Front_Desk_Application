package com.medplus.frontdesk_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HostPortalDto {
    private String hostName;
    private String mobileMasked;
    private List<HostPortalVisitDto> visits;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class HostPortalMemberDto {
        private String visitorId;
        private String visitorName;
        private String visitorMobile;
        private String empId;
        private String status;
        private String entryType;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class HostPortalVisitDto {
        /** Set for group visits (MED-GROUP-####). Null for individual. */
        private String groupId;
        private Integer memberCount;
        /** Currently PENDING_APPROVAL members in the group. */
        private Integer pendingCount;
        private List<HostPortalMemberDto> members;

        private String visitorId;
        private String visitorName;
        private String visitorMobile;
        private String companyName;
        private String reasonForVisit;
        private String department;
        private String locationId;
        private String locationName;
        private String personName;
        private LocalDateTime checkInTime;
        private LocalDateTime approvedAt;
        private LocalDateTime rejectedAt;
        /** Frontend label: pending-approval | checked-in | rejected */
        private String status;
        private String entryType;
        private String rejectionRemarks;
    }
}
