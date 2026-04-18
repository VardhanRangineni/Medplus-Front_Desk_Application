package com.medplus.frontdesk_backend.controller;

import com.medplus.frontdesk_backend.dto.zimbra.CalendarEventDto;
import com.medplus.frontdesk_backend.service.ZimbraCalendarService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/zimbra/calendar")
@RequiredArgsConstructor
public class ZimbraCalendarController {

    private final ZimbraCalendarService zimbraCalendarService;

    @GetMapping("/events")
    public ResponseEntity<List<CalendarEventDto>> getEvents(
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate) {
        return ResponseEntity.ok(zimbraCalendarService.getEvents(fromDate, toDate));
    }
}
