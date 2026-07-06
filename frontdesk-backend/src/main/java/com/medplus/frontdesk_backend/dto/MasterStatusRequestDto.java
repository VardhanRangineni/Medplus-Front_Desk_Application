package com.medplus.frontdesk_backend.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class MasterStatusRequestDto {
    @NotNull
    private Boolean active;
}
