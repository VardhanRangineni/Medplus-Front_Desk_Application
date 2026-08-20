package com.medplus.frontdesk_backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class HostPortalMemberDecisionsRequestDto {

    @NotEmpty(message = "At least one decision is required")
    @Valid
    private List<MemberDecision> decisions;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MemberDecision {
        @NotBlank(message = "visitorId is required")
        private String visitorId;

        /** APPROVED or REJECTED */
        @NotBlank(message = "decision is required")
        private String decision;

        /** Required when decision is REJECTED (optional free text). */
        private String remarks;
    }
}
