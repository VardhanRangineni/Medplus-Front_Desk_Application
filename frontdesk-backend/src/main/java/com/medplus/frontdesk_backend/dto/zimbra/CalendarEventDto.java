package com.medplus.frontdesk_backend.dto.zimbra;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class CalendarEventDto {
    private String id;
    private String title;
    private String start;
    private String end;
    private String location;
    private boolean allDay;
}
