package com.medplus.frontdesk_backend.dto.zimbra;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class MailDetailDto {
    private String id;
    private String subject;
    private String from;
    private String fromName;
    private String to;
    private String date;
    private String bodyText;
    private String bodyHtml;
    /** Attachments on this message — empty list if the mail has none. */
    private List<AttachmentDto> attachments;
}
