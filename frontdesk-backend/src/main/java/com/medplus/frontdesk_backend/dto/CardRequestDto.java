package com.medplus.frontdesk_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/** Response DTO for listing card requests. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CardRequestDto {

    private Long          id;
    private String        locationId;
    private String        locationName;

    /** ADDITIONAL | REPLACEMENT */
    private String        requestType;

    private int           quantity;
    private String        notes;

    /** PENDING | FULFILLED | CANCELLED */
    private String        status;

    private String        requestedBy;
    private LocalDateTime requestedAt;
    private LocalDateTime fulfilledAt;
    private String        fulfilledBy;

    /** Null until the cards PDF for this batch has been downloaded. */
    private LocalDateTime downloadedAt;
}
