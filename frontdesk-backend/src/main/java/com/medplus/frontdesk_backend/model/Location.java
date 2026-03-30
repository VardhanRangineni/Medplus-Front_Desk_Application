package com.medplus.frontdesk_backend.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Location {

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
}
