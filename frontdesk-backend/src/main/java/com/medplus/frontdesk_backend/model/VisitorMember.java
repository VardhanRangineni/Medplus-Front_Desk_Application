package com.medplus.frontdesk_backend.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VisitorMember {

    private String        memberId;
    private String        visitorId;
    private String        name;
    private Integer       cardNumber;
    private String        cardCode;
    private VisitStatus   status;
    private LocalDateTime checkOutTime;
}
