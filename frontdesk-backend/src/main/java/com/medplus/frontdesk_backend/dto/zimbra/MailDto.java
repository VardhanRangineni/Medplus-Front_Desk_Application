package com.medplus.frontdesk_backend.dto.zimbra;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class MailDto {
    private String id;
    private String subject;
    private String from;
    private String fromName;
    private String date;
    private String preview;
    private boolean unread;
}
