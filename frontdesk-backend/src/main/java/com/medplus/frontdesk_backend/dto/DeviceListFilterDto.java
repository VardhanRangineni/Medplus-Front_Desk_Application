package com.medplus.frontdesk_backend.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class DeviceListFilterDto {
    private String locationId;
    /** When set (and locationId empty), restrict to these location IDs. */
    private List<String> locationIds;
    private String displayName;
    private String status;
}
