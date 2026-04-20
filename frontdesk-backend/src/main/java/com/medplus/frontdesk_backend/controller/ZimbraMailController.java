package com.medplus.frontdesk_backend.controller;

import com.medplus.frontdesk_backend.dto.zimbra.MailDetailDto;
import com.medplus.frontdesk_backend.dto.zimbra.MailDto;
import com.medplus.frontdesk_backend.service.ZimbraMailService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
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

    /**
     * Streams an email attachment to the browser.
     *
     * <pre>GET /zimbra/mails/{id}/attachments/{partId}?filename=foo.pdf</pre>
     *
     * <p>The backend proxies the Zimbra REST endpoint so the browser doesn't
     * need a Zimbra cookie — the session cookie we already validate (via the
     * interceptor) carries the authenticated user; we re-authenticate with
     * their {@code authToken} server-side.
     *
     * <p>{@code filename} is optional — it's only used to set the download
     * filename suggested to the browser. If Zimbra returns its own
     * Content-Disposition header we prefer that.
     */
    @GetMapping("/{id}/attachments/{partId}")
    public ResponseEntity<byte[]> downloadAttachment(
            @PathVariable String id,
            @PathVariable String partId,
            @RequestParam(required = false) String filename) {

        ResponseEntity<byte[]> zimbraResp =
                zimbraMailService.downloadAttachment(id, partId);

        HttpHeaders headers = new HttpHeaders();

        // Preserve Zimbra's content-type if present, otherwise default to octet-stream
        MediaType contentType = zimbraResp.getHeaders().getContentType();
        headers.setContentType(contentType != null ? contentType : MediaType.APPLICATION_OCTET_STREAM);

        // Force "attachment" disposition so browsers always trigger a download
        String safeName = (filename != null && !filename.isBlank())
                ? URLEncoder.encode(filename, StandardCharsets.UTF_8).replace("+", "%20")
                : "attachment";
        headers.set(HttpHeaders.CONTENT_DISPOSITION,
                "attachment; filename=\"" + safeName + "\"; filename*=UTF-8''" + safeName);

        byte[] body = zimbraResp.getBody();
        if (body != null) headers.setContentLength(body.length);

        return new ResponseEntity<>(body, headers, zimbraResp.getStatusCode());
    }
}
