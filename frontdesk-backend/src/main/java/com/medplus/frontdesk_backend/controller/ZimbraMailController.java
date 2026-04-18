package com.medplus.frontdesk_backend.controller;

import com.medplus.frontdesk_backend.dto.zimbra.MailDetailDto;
import com.medplus.frontdesk_backend.dto.zimbra.MailDto;
import com.medplus.frontdesk_backend.service.ZimbraMailService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/zimbra/mails")
@RequiredArgsConstructor
public class ZimbraMailController {

    private final ZimbraMailService zimbraMailService;

    @GetMapping("/inbox")
    public ResponseEntity<List<MailDto>> getInbox(
            @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(zimbraMailService.getInbox(limit));
    }

    @GetMapping("/{id}")
    public ResponseEntity<MailDetailDto> getMailById(@PathVariable String id) {
        MailDetailDto mail = zimbraMailService.getMessageById(id);
        return mail != null ? ResponseEntity.ok(mail) : ResponseEntity.notFound().build();
    }

    /**
     * Marks a message as read in Zimbra.
     *
     * <pre>PUT /zimbra/mails/{id}/read</pre>
     *
     * Called by the frontend when the user opens an email.
     * Returns 204 No Content on success.
     */
    @PutMapping("/{id}/read")
    public ResponseEntity<Void> markAsRead(@PathVariable String id) {
        zimbraMailService.markAsRead(id);
        return ResponseEntity.noContent().build();
    }
}
