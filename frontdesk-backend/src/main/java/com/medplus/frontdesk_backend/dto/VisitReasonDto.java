package com.medplus.frontdesk_backend.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.medplus.frontdesk_backend.model.VisitReasonType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * View DTO for a visit reason. Returned to the frontend admin UI and dropdown consumers.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class VisitReasonDto {
    private Long              id;
    private VisitReasonType   type;
    private String            reasonName;
    private boolean           isActive;
    private LocalDateTime     createdAt;
    private LocalDateTime     modifiedAt;
}
