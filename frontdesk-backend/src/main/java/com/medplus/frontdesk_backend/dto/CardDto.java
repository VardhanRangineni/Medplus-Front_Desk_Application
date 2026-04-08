package com.medplus.frontdesk_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CardDto {

    private Long          id;
    private String        locationId;
    private String        locationName;

    /** Full card code, e.g. MSOH-VISITOR-1 */
    private String        cardCode;

    /** AVAILABLE | ASSIGNED | MISSING */
    private String        status;

    /** visitorId this card is currently assigned to, or null */
    private String        assignedTo;

    /** Name of the visitor currently holding this card, or null */
    private String        assignedToName;

    private LocalDateTime assignedAt;
    private LocalDateTime createdAt;
}
