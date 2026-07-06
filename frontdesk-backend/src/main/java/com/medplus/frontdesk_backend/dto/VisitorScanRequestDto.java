package com.medplus.frontdesk_backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class VisitorScanRequestDto {

    /**
     * Raw QR payload or token — supports PREREG:hex, VISITOR:MED-V-0001, or MED-V-0001.
     */
    @NotBlank(message = "Scan payload is required.")
    private String payload;
}
