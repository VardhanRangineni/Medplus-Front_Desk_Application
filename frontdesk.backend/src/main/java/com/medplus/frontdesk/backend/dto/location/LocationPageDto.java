package com.medplus.frontdesk.backend.dto.location;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Paginated list of locations returned by GET /admin/locations. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LocationPageDto {
    private List<LocationDto> rows;
    private int page;
    private int pageSize;
    private int totalRows;
    private int totalPages;
}
