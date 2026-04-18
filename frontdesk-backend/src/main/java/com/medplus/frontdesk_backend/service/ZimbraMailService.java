package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.config.ZimbraCache;
import com.medplus.frontdesk_backend.dto.zimbra.MailDetailDto;
import com.medplus.frontdesk_backend.dto.zimbra.MailDto;
import com.medplus.frontdesk_backend.integration.ZimbraContext;
import com.medplus.frontdesk_backend.integration.ZimbraSoapClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
                    .subject(attr(m, "su"))
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
        return MailDetailDto.builder()
                .id(attr(m, "id"))
                .subject(attr(m, "su"))
                .from(findEnvelope(m, "f", "a"))
                .fromName(findEnvelope(m, "f", "p"))
                .to(findEnvelope(m, "t", "a"))
                .date(formatEpochMs(attr(m, "d")))
                .bodyText(extractBody(m, "text/plain"))
                .bodyHtml(extractBody(m, "text/html"))
                .build();
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
