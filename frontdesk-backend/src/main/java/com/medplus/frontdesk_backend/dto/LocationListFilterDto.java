package com.medplus.frontdesk_backend.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class LocationListFilterDto {
    private String locationId;
    private String locationName;
    private String status;
}
