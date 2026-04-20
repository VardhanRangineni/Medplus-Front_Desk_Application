package com.medplus.frontdesk_backend.dto.zimbra;

import lombok.Builder;
import lombok.Data;

/**
 * Represents a single downloadable attachment on a Zimbra mail message.
 *
 * <p>Fields are extracted from the {@code <mp>} (message-part) elements of a
 * Zimbra {@code GetMsgResponse} whose content-disposition is {@code attachment}.
 */
@Data
@Builder
public class AttachmentDto {
    /** Message id this attachment belongs to — needed to build the download URL. */
    private String messageId;

    /** Zimbra "part" id, e.g. {@code "2"} or {@code "2.1"}. Needed to download. */
    private String partId;

    /** Original filename as provided in the MIME part. May be empty. */
    private String filename;

    /** MIME type, e.g. {@code application/pdf}. */
    private String contentType;

    /** Size in bytes (0 if unknown). */
    private long size;
}
