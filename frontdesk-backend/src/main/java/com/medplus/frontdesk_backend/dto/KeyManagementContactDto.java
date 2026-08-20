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
public class KeyManagementContactDto {
    private Long id;
    private String mobile;
    private String displayName;
    private String portalToken;
    /** Full public portal URL — filled by service for admin UI / SMS preview. */
    private String portalUrl;
    private boolean active;
    private LocalDateTime createdAt;
    private LocalDateTime modifiedAt;
}
