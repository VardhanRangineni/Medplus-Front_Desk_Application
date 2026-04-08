package com.medplus.frontdesk_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PreRegGroupLinkDto {
    private String groupToken;
    private String locationId;
    private String locationName;
    private Instant expiresAt;
}
