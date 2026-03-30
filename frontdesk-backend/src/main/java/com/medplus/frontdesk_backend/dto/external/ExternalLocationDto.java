package com.medplus.frontdesk_backend.dto.external;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Maps one location record from the external HR/ERP API.
 *
 * Expected JSON shape:
 * {
 *   "locationId":      "HO-HO-HYD",
 *   "descriptiveName": "Medplus Head Office Hyderabad",
 *   "type":            "HEAD_OFFICE",
 *   "coordinates":     "17.4486,78.3908",
 *   "address":         "Plot No. 14, Balnagar Industrial Area",
 *   "city":            "Hyderabad",
 *   "state":           "Telangana",
 *   "pincode":         "500037"
 * }
 *
 * NOTE: status, createdBy, modifiedBy, createdAt, modifiedAt are NOT
 * supplied by the external API — they are managed by this application only.
 */
@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ExternalLocationDto {

    @JsonProperty("locationId")
    private String locationId;

    @JsonProperty("descriptiveName")
    private String descriptiveName;

    @JsonProperty("type")
    private String type;

    @JsonProperty("coordinates")
    private String coordinates;

    @JsonProperty("address")
    private String address;

    @JsonProperty("city")
    private String city;

    @JsonProperty("state")
    private String state;

    @JsonProperty("pincode")
    private String pincode;
}
