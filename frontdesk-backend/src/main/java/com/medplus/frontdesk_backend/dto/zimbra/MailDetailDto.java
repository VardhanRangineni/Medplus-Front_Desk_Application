package com.medplus.frontdesk_backend.dto.zimbra;

import lombok.Builder;
import lombok.Data;

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
}
