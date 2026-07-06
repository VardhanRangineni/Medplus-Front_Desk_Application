package com.medplus.frontdesk_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CityMasterDto {
    private Long   id;
    private String cityCode;
    private String cityName;
    private String stateCode;
    private boolean active;
}
