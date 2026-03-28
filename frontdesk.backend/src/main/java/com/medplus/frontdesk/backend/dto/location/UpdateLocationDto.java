package com.medplus.frontdesk.backend.dto.location;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Request body for PUT /admin/locations/{locationId}. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateLocationDto {

    @NotBlank(message = "descriptiveName is required")
    @Size(max = 150)
    private String descriptiveName;

    @NotBlank(message = "type is required")
    @Size(max = 150)
    private String type;

    @Size(max = 100)
    private String coordinates;

    @NotBlank(message = "address is required")
    @Size(max = 255)
    private String address;

    @NotBlank(message = "city is required")
    @Size(max = 100)
    private String city;

    @NotBlank(message = "state is required")
    @Size(max = 100)
    private String state;

    @NotBlank(message = "pincode is required")
    @Size(max = 20)
    private String pincode;

    @NotBlank(message = "status is required")
    @Pattern(regexp = "CONFIGURED|NOTCONFIGURED",
             message = "status must be CONFIGURED or NOTCONFIGURED")
    private String status;
}
