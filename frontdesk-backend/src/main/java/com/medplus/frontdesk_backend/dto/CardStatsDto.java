package com.medplus.frontdesk_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CardStatsDto {

    private String locationId;
    private String locationName;

    private int total;
    private int available;
    private int assigned;
    private int missing;
}
