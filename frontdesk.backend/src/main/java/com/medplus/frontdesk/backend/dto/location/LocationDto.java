package com.medplus.frontdesk.backend.dto.location;

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Full location record returned by GET /admin/locations. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LocationDto {
    private String locationId;
    private String descriptiveName;
    private String type;
    private String coordinates;
    private String address;
    private String city;
    private String state;
    private String pincode;
    private String status;
    private String createdBy;
    private String modifiedBy;
    private LocalDateTime createdAt;
    private LocalDateTime modifiedAt;
}
