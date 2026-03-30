package com.medplus.frontdesk_backend.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class SyncResultDto {

    private int locationsFetched;
    private int locationsInserted;
    private int locationsUpdated;

    private int employeesFetched;
    private int employeesInserted;
    private int employeesUpdated;

    private String triggeredBy;
    private String syncedAt;
}
