package com.medplus.frontdesk_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LocationMasterDto {
    private String locationId;
    private String descriptiveName;
    private String address;
    private String stateCode;
    private String stateName;
    private String cityCode;
    private String cityName;
    private Long   companyId;
    private String companyName;
    private Long   locationTypeId;
    private String locationTypeName;
    private boolean active;
}
