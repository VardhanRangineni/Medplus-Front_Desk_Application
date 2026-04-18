package com.medplus.frontdesk_backend.controller;

import com.medplus.frontdesk_backend.dto.zimbra.CalendarEventDto;
import com.medplus.frontdesk_backend.dto.zimbra.MeetingRespondRequestDto;
import com.medplus.frontdesk_backend.service.ZimbraCalendarService;
import jakarta.validation.Valid;
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

    /**
     * Respond to a Zimbra meeting invite.
     *
     * <pre>
     * POST /zimbra/calendar/events/{inviteId}/respond
     * Cookie: zimbraSessionId=&lt;session&gt;
     *
     * { "status": "AC" }   // AC | DE | TE
     * </pre>
     *
     * <p>Returns the updated event shell with the confirmed {@code ptst} value.
     * The UI should optimistically update before this call returns, and reconcile
     * on the resolved value.
     *
     * @param inviteId  Zimbra invite message ID (the {@code invId} field on the event DTO)
     * @param body      request body carrying the status code
     */
    @PostMapping("/events/{inviteId}/respond")
    public ResponseEntity<CalendarEventDto> respondToMeeting(
            @PathVariable String inviteId,
            @Valid @RequestBody MeetingRespondRequestDto body) {
        CalendarEventDto updated = zimbraCalendarService.respondToMeeting(inviteId, body.getStatus());
        return ResponseEntity.ok(updated);
    }
}
