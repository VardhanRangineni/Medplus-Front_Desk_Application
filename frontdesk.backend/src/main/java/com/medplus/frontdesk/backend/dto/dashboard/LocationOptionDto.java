package com.medplus.frontdesk.backend.dto.dashboard;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LocationOptionDto {
    private String locationId;
    private String descriptiveName;
    private String type;
    private String city;
    private String state;
    private String status;
}

