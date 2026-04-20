package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.config.ZimbraCache;
import com.medplus.frontdesk_backend.dto.zimbra.AttachmentDto;
import com.medplus.frontdesk_backend.dto.zimbra.MailDetailDto;
import com.medplus.frontdesk_backend.dto.zimbra.MailDto;
import com.medplus.frontdesk_backend.integration.ZimbraContext;
import com.medplus.frontdesk_backend.integration.ZimbraSoapClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.w3c.dom.*;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ZimbraMailService {

    private static final DateTimeFormatter DATE_FMT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm").withZone(ZoneId.of("Asia/Kolkata"));

    private final ZimbraSoapClient zimbraSoapClient;
    private final ZimbraCache cache;

    public List<MailDto> getInbox(int limit) {
        String email = ZimbraContext.getEmail();
        String cacheKey = cache.key(email, "inbox", String.valueOf(limit));

        return cache.<List<MailDto>>get(cacheKey).orElseGet(() -> {
            long start = System.currentTimeMillis();
            Document doc = zimbraSoapClient.searchMessages(ZimbraContext.getAuthToken(), "in:inbox", limit);
            List<MailDto> result = parseMessages(doc);
            log.info("[Zimbra] getInbox email={} count={} latency={}ms",
                    email, result.size(), System.currentTimeMillis() - start);
            cache.put(cacheKey, result);
            return result;
        });
    }

    public MailDetailDto getMessageById(String messageId) {
        String email = ZimbraContext.getEmail();
        long start = System.currentTimeMillis();
        Document doc = zimbraSoapClient.getMessage(ZimbraContext.getAuthToken(), messageId);
        MailDetailDto result = parseMessageDetail(doc);
        log.info("[Zimbra] getMessage email={} msgId={} latency={}ms",
                email, messageId, System.currentTimeMillis() - start);
        return result;
    }

    /**
     * Marks a message as read in Zimbra and evicts the inbox cache so the
     * next {@link #getInbox} call returns the updated unread flag.
     */
    public void markAsRead(String messageId) {
        String email = ZimbraContext.getEmail();
        zimbraSoapClient.markMessageRead(ZimbraContext.getAuthToken(), messageId);
        // Evict all inbox cache entries for this user so the blue dot clears on next load
        cache.evictByPrefix(email + ":inbox");
        log.debug("[Zimbra] markAsRead email={} msgId={}", email, messageId);
    }

    /**
     * Returns the total number of unread emails in the Inbox folder.
     * Uses {@code GetFolderRequest} and reads the {@code u} (unread) attribute
     * from the {@code <folder>} element representing {@code /Inbox}. This is
     * the authoritative source for Zimbra unread counts.
     */
    public int getUnreadCount() {
        try {
            Document doc = zimbraSoapClient.getInboxFolder(ZimbraContext.getAuthToken());
            NodeList folders = doc.getElementsByTagName("folder");
            // Look for the folder named "Inbox" (there may be nested folders returned)
            for (int i = 0; i < folders.getLength(); i++) {
                if (!(folders.item(i) instanceof Element f)) continue;
                String name = f.getAttribute("name");
                String absFolderPath = f.getAttribute("absFolderPath");
                boolean isInbox = "Inbox".equalsIgnoreCase(name)
                        || "/Inbox".equalsIgnoreCase(absFolderPath);
                if (isInbox) {
                    String u = f.getAttribute("u");
                    if (!u.isBlank()) {
                        try { return Integer.parseInt(u); }
                        catch (NumberFormatException ignored) {}
                    }
                }
            }
            // Fallback: first folder in response usually is the requested one
            if (folders.getLength() > 0 && folders.item(0) instanceof Element first) {
                String u = first.getAttribute("u");
                if (!u.isBlank()) {
                    try { return Integer.parseInt(u); }
                    catch (NumberFormatException ignored) {}
                }
            }
        } catch (Exception ex) {
            log.warn("[Zimbra] getUnreadCount failed: {}", ex.getMessage());
        }
        return 0;
    }

    /**
     * Streams an attachment's binary content from Zimbra, authenticated with
     * the current user's session token. The controller re-emits the bytes to
     * the browser with an {@code attachment} content-disposition so the user
     * gets a native download.
     */
    public ResponseEntity<byte[]> downloadAttachment(String messageId, String partId) {
        return zimbraSoapClient.downloadAttachment(
                ZimbraContext.getAuthToken(), messageId, partId);
    }

    // ── parsers ──────────────────────────────────────────────────────────────

    private List<MailDto> parseMessages(Document doc) {
        List<MailDto> result = new ArrayList<>();
        NodeList messages = doc.getElementsByTagName("m");

        for (int i = 0; i < messages.getLength(); i++) {
            Node node = messages.item(i);
            if (!(node instanceof Element m)) continue;
            Node parent = m.getParentNode();
            if (parent == null || !parent.getNodeName().contains("SearchResponse")) continue;

            result.add(MailDto.builder()
                    .id(attr(m, "id"))
                    .subject(readSubject(m))
                    .from(findEnvelope(m, "f", "a"))
                    .fromName(findEnvelope(m, "f", "p"))
                    .date(formatEpochMs(attr(m, "d")))
                    .preview(childText(m, "fr"))
                    .unread(attr(m, "f").contains("u"))
                    .build());
        }
        return result;
    }

    private MailDetailDto parseMessageDetail(Document doc) {
        NodeList msgs = doc.getElementsByTagName("m");
        if (msgs.getLength() == 0) return null;
        Element m = (Element) msgs.item(0);
        String messageId = attr(m, "id");
        return MailDetailDto.builder()
                .id(messageId)
                .subject(readSubject(m))
                .from(findEnvelope(m, "f", "a"))
                .fromName(findEnvelope(m, "f", "p"))
                .to(findEnvelope(m, "t", "a"))
                .date(formatEpochMs(attr(m, "d")))
                .bodyText(extractBody(m, "text/plain"))
                .bodyHtml(extractBody(m, "text/html"))
                .attachments(extractAttachments(m, messageId))
                .build();
    }

    /**
     * Walks every {@code <mp>} node under the given message element and
     * collects the ones whose content-disposition ({@code cd}) is
     * {@code "attachment"}. Inline images ({@code cd="inline"}) and the
     * message body parts are skipped so only real attachments show up in
     * the UI.
     */
    private List<AttachmentDto> extractAttachments(Element m, String messageId) {
        List<AttachmentDto> out = new ArrayList<>();
        NodeList parts = m.getElementsByTagName("mp");
        for (int i = 0; i < parts.getLength(); i++) {
            if (!(parts.item(i) instanceof Element mp)) continue;
            // Zimbra marks attachments with cd="attachment"
            if (!"attachment".equalsIgnoreCase(attr(mp, "cd"))) continue;

            long size = 0;
            try { size = Long.parseLong(attr(mp, "s")); } catch (NumberFormatException ignored) {}

            out.add(AttachmentDto.builder()
                    .messageId(messageId)
                    .partId(attr(mp, "part"))
                    .filename(attr(mp, "filename"))
                    .contentType(attr(mp, "ct"))
                    .size(size)
                    .build());
        }
        return out;
    }

    /**
     * Zimbra returns the subject as a DIRECT CHILD element {@code <su>} on
     * {@code <m>} inside SearchResponse and GetMsgResponse. Some older
     * versions expose it as an attribute, so we fall back for safety.
     * We only consider direct children — NOT nested message parts — so we
     * don't accidentally pick up an embedded forwarded/replied subject.
     */
    private String readSubject(Element m) {
        NodeList children = m.getChildNodes();
        for (int i = 0; i < children.getLength(); i++) {
            Node c = children.item(i);
            if (c.getNodeType() == Node.ELEMENT_NODE && "su".equals(c.getNodeName())) {
                String txt = c.getTextContent();
                if (txt != null && !txt.isBlank()) return txt.trim();
            }
        }
        return attr(m, "su");
    }

    private String findEnvelope(Element m, String type, String attrName) {
        NodeList envelopes = m.getElementsByTagName("e");
        for (int i = 0; i < envelopes.getLength(); i++) {
            Element e = (Element) envelopes.item(i);
            if (type.equals(attr(e, "t"))) return attr(e, attrName);
        }
        return "";
    }

    private String extractBody(Element m, String contentType) {
        NodeList parts = m.getElementsByTagName("mp");
        for (int i = 0; i < parts.getLength(); i++) {
            Element mp = (Element) parts.item(i);
            if (contentType.equals(attr(mp, "ct")) && "1".equals(attr(mp, "body"))) {
                return childText(mp, "content");
            }
        }
        for (int i = 0; i < parts.getLength(); i++) {
            Element mp = (Element) parts.item(i);
            if (contentType.equals(attr(mp, "ct"))) {
                String c = childText(mp, "content");
                if (!c.isBlank()) return c;
            }
        }
        return "";
    }

    private String formatEpochMs(String epochMs) {
        if (epochMs == null || epochMs.isBlank()) return "";
        try { return DATE_FMT.format(Instant.ofEpochMilli(Long.parseLong(epochMs))); }
        catch (NumberFormatException e) { return epochMs; }
    }

    private String attr(Element el, String name) {
        String v = el.getAttribute(name); return v == null ? "" : v;
    }

    private String childText(Element parent, String tagName) {
        NodeList list = parent.getElementsByTagName(tagName);
        return list.getLength() > 0 ? list.item(0).getTextContent().trim() : "";
    }
}
