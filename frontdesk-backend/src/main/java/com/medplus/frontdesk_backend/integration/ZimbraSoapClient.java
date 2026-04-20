package com.medplus.frontdesk_backend.integration;

import com.medplus.frontdesk_backend.dto.zimbra.ZimbraEventRequestDto;
import com.medplus.frontdesk_backend.exception.ZimbraException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.RestTemplate;
import org.w3c.dom.*;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class ZimbraSoapClient {

    @Value("${zimbra.soap.url}")
    private String zimbraSoapUrl;

    private final RestTemplate restTemplate;

    public Document authenticate(String email, String password) {
        String soap = """
                <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                  <soap:Body>
                    <AuthRequest xmlns="urn:zimbraAccount">
                      <account by="name">%s</account>
                      <password>%s</password>
                    </AuthRequest>
                  </soap:Body>
                </soap:Envelope>
                """.formatted(escapeXml(email), escapeXml(password));

        return postSoap(soap);
    }

    public Document searchMessages(String authToken, String query, int limit) {
        String soap = """
                <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                  <soap:Header>
                    <context xmlns="urn:zimbra">
                      <authToken>%s</authToken>
                    </context>
                  </soap:Header>
                  <soap:Body>
                    <SearchRequest xmlns="urn:zimbraMail" types="message" limit="%d">
                      <query>%s</query>
                    </SearchRequest>
                  </soap:Body>
                </soap:Envelope>
                """.formatted(authToken, limit, escapeXml(query));

        return postSoap(soap);
    }

    public Document getMessage(String authToken, String messageId) {
        String soap = """
                <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                  <soap:Header>
                    <context xmlns="urn:zimbra">
                      <authToken>%s</authToken>
                    </context>
                  </soap:Header>
                  <soap:Body>
                    <GetMsgRequest xmlns="urn:zimbraMail">
                      <m id="%s" html="1"/>
                    </GetMsgRequest>
                  </soap:Body>
                </soap:Envelope>
                """.formatted(authToken, escapeXml(messageId));

        return postSoap(soap);
    }

    public Document searchCalendar(String authToken, Long startMs, Long endMs) {
        String calAttrs = (startMs != null && endMs != null)
                ? " calExpandInstStart=\"%d\" calExpandInstEnd=\"%d\"".formatted(startMs, endMs)
                : "";

        String soap = """
                <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                  <soap:Header>
                    <context xmlns="urn:zimbra">
                      <authToken>%s</authToken>
                    </context>
                  </soap:Header>
                  <soap:Body>
                    <SearchRequest xmlns="urn:zimbraMail" types="appointment"%s>
                      <query>in:calendar</query>
                    </SearchRequest>
                  </soap:Body>
                </soap:Envelope>
                """.formatted(authToken, calAttrs);

        return postSoap(soap);
    }

    /**
     * GetFreeBusyRequest — returns free/busy information for {@code email}
     * between {@code startMs} and {@code endMs} (epoch milliseconds).
     *
     * The service account token is used; no delegate access is required for
     * free/busy checks on Zimbra.
     */
    public Document getFreeBusy(String authToken, String email, long startMs, long endMs) {
        String soap = """
                <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                  <soap:Header>
                    <context xmlns="urn:zimbra">
                      <authToken>%s</authToken>
                    </context>
                  </soap:Header>
                  <soap:Body>
                    <GetFreeBusyRequest xmlns="urn:zimbraMail" s="%d" e="%d">
                      <usr l="%s"/>
                    </GetFreeBusyRequest>
                  </soap:Body>
                </soap:Envelope>
                """.formatted(authToken, startMs, endMs, escapeXml(email));

        return postSoap(soap);
    }

    /**
     * CreateAppointmentRequest — creates a calendar event under the service account
     * and sends meeting invites to all attendees in {@code event.attendeeEmails}.
     *
     * Date/time format expected by Zimbra: {@code yyyyMMdd'T'HHmmss}, timezone
     * annotation passed separately so Zimbra handles DST correctly.
     */
    public Document createAppointment(String authToken, ZimbraEventRequestDto event) {
        DateTimeFormatter dtFmt = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss");
        String startStr = event.getStart().format(dtFmt);
        String endStr   = event.getEnd().format(dtFmt);

        // <at> elements — one per attendee
        List<String> emails = event.getAttendeeEmails() != null ? event.getAttendeeEmails() : List.of();
        String attendeeXml = emails.stream()
                .map(a -> "<at a=\"%s\" role=\"REQ\" ptst=\"NE\" rsvp=\"1\"/>".formatted(escapeXml(a)))
                .collect(Collectors.joining("\n                        "));

        // <e t="t"> (To: recipients) — same list, so invites are emailed
        String toXml = emails.stream()
                .map(a -> "<e t=\"t\" a=\"%s\"/>".formatted(escapeXml(a)))
                .collect(Collectors.joining("\n                    "));

        String location    = escapeXml(event.getLocation() != null ? event.getLocation() : "");
        String description = escapeXml(event.getDescription() != null ? event.getDescription() : "");
        String title       = escapeXml(event.getTitle() != null ? event.getTitle() : "");
        String organizer   = escapeXml(event.getOrganizerEmail() != null ? event.getOrganizerEmail() : "");

        String soap = """
                <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                  <soap:Header>
                    <context xmlns="urn:zimbra">
                      <authToken>%s</authToken>
                    </context>
                  </soap:Header>
                  <soap:Body>
                    <CreateAppointmentRequest xmlns="urn:zimbraMail">
                      <m>
                        <inv>
                          <comp name="%s" status="CONF" allDay="0" class="PUB" transp="O" fb="B" loc="%s">
                            <s d="%s" tz="Asia/Kolkata"/>
                            <e d="%s" tz="Asia/Kolkata"/>
                            <or a="%s" d="Front Desk Calendar"/>
                            %s
                            <desc>%s</desc>
                          </comp>
                        </inv>
                        %s
                        <su>%s</su>
                        <mp ct="multipart/alternative">
                          <mp ct="text/plain">
                            <content>%s</content>
                          </mp>
                        </mp>
                      </m>
                    </CreateAppointmentRequest>
                  </soap:Body>
                </soap:Envelope>
                """.formatted(
                authToken,
                title, location,
                startStr, endStr,
                organizer,
                attendeeXml,
                description,
                toXml,
                title,
                description
        );

        return postSoap(soap);
    }

    /**
     * ModifyAppointmentRequest — reschedule an existing calendar event in place.
     *
     * <p>Zimbra requires the caller to replay the full invite (comp/or/at/desc)
     * so we build the same envelope as {@link #createAppointment} with the new
     * start/end and the target event's {@code id} + {@code comp="0"} attrs on
     * the {@code <ModifyAppointmentRequest>} root.
     *
     * @param authToken  caller's auth token (service account when reschedule is
     *                   initiated by the booking system)
     * @param inviteId   Zimbra {@code invId} returned at create-time
     * @param event      new event payload (new start/end + unchanged metadata)
     */
    public Document modifyAppointment(String authToken, String inviteId, ZimbraEventRequestDto event) {
        DateTimeFormatter dtFmt = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss");
        String startStr = event.getStart().format(dtFmt);
        String endStr   = event.getEnd().format(dtFmt);

        List<String> emails = event.getAttendeeEmails() != null ? event.getAttendeeEmails() : List.of();
        String attendeeXml = emails.stream()
                .map(a -> "<at a=\"%s\" role=\"REQ\" ptst=\"NE\" rsvp=\"1\"/>".formatted(escapeXml(a)))
                .collect(Collectors.joining("\n                        "));
        String toXml = emails.stream()
                .map(a -> "<e t=\"t\" a=\"%s\"/>".formatted(escapeXml(a)))
                .collect(Collectors.joining("\n                    "));

        String location    = escapeXml(event.getLocation()       != null ? event.getLocation()       : "");
        String description = escapeXml(event.getDescription()    != null ? event.getDescription()    : "");
        String title       = escapeXml(event.getTitle()          != null ? event.getTitle()          : "");
        String organizer   = escapeXml(event.getOrganizerEmail() != null ? event.getOrganizerEmail() : "");

        // id = invite id; comp=0 = primary component; the rest of the <m> payload
        // is identical to create — Zimbra replaces the event atomically.
        String soap = """
                <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                  <soap:Header>
                    <context xmlns="urn:zimbra">
                      <authToken>%s</authToken>
                    </context>
                  </soap:Header>
                  <soap:Body>
                    <ModifyAppointmentRequest xmlns="urn:zimbraMail" id="%s" comp="0">
                      <m>
                        <inv>
                          <comp name="%s" status="CONF" allDay="0" class="PUB" transp="O" fb="B" loc="%s">
                            <s d="%s" tz="Asia/Kolkata"/>
                            <e d="%s" tz="Asia/Kolkata"/>
                            <or a="%s" d="Front Desk Calendar"/>
                            %s
                            <desc>%s</desc>
                          </comp>
                        </inv>
                        %s
                        <su>%s</su>
                        <mp ct="multipart/alternative">
                          <mp ct="text/plain">
                            <content>%s</content>
                          </mp>
                        </mp>
                      </m>
                    </ModifyAppointmentRequest>
                  </soap:Body>
                </soap:Envelope>
                """.formatted(
                authToken,
                escapeXml(inviteId),
                title, location,
                startStr, endStr,
                organizer,
                attendeeXml,
                description,
                toXml,
                title,
                description
        );

        return postSoap(soap);
    }

    /**
     * CancelAppointmentRequest — used when an employee declines so the
     * service-account organiser removes the event from every attendee's calendar.
     * Accepts the Zimbra {@code invId} produced at create-time.
     */
    public Document cancelAppointment(String authToken, String inviteId) {
        String soap = """
                <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                  <soap:Header>
                    <context xmlns="urn:zimbra">
                      <authToken>%s</authToken>
                    </context>
                  </soap:Header>
                  <soap:Body>
                    <CancelAppointmentRequest xmlns="urn:zimbraMail" id="%s" comp="0"/>
                  </soap:Body>
                </soap:Envelope>
                """.formatted(authToken, escapeXml(inviteId));
        return postSoap(soap);
    }

    /**
     * GetFolderRequest for the Inbox (id=2). The returned {@code <folder>}
     * element carries a {@code u} attribute with the unread-message count.
     * This is the authoritative way to get unread count in Zimbra (the
     * SearchResponse {@code size} attribute is not a total match count).
     */
    public Document getInboxFolder(String authToken) {
        String soap = """
                <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                  <soap:Header>
                    <context xmlns="urn:zimbra">
                      <authToken>%s</authToken>
                    </context>
                  </soap:Header>
                  <soap:Body>
                    <GetFolderRequest xmlns="urn:zimbraMail">
                      <folder path="/Inbox"/>
                    </GetFolderRequest>
                  </soap:Body>
                </soap:Envelope>
                """.formatted(authToken);

        return postSoap(soap);
    }

    /**
     * MsgActionRequest — marks a message as read in the authenticated user's mailbox.
     *
     * @param authToken employee's Zimbra auth token
     * @param messageId the message ID to mark as read
     */
    public Document markMessageRead(String authToken, String messageId) {
        String soap = """
                <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                  <soap:Header>
                    <context xmlns="urn:zimbra">
                      <authToken>%s</authToken>
                    </context>
                  </soap:Header>
                  <soap:Body>
                    <MsgActionRequest xmlns="urn:zimbraMail">
                      <action op="read" id="%s"/>
                    </MsgActionRequest>
                  </soap:Body>
                </soap:Envelope>
                """.formatted(authToken, escapeXml(messageId));

        return postSoap(soap);
    }

    /**
     * SendInviteReplyRequest — responds to a meeting invite on behalf of the
     * authenticated employee.
     *
     * <p>The {@code inviteId} is the Zimbra <b>message</b> ID of the invite
     * notification email (the {@code invId} attribute on the {@code <appt>}
     * element returned by SearchRequest, not the calendar item id).
     *
     * <p>Mapping of {@code ptst} codes to SOAP verb:
     * <ul>
     *   <li>{@code AC} → ACCEPT</li>
     *   <li>{@code DE} → DECLINE</li>
     *   <li>{@code TE} → TENTATIVE</li>
     * </ul>
     *
     * @param authToken  employee's Zimbra auth token (from ZimbraContext, NOT the service account)
     * @param inviteId   invite message ID ({@code invId} from the calendar search)
     * @param ptst       participation status code: AC, DE, or TE
     * @return parsed Zimbra SOAP response document
     */
    public Document sendInviteReply(String authToken, String inviteId, String ptst) {
        String verb = switch (ptst.toUpperCase()) {
            case "AC" -> "ACCEPT";
            case "DE" -> "DECLINE";
            case "TE" -> "TENTATIVE";
            default   -> throw new ZimbraException("Unknown participation status: " + ptst);
        };

        String soap = """
                <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                  <soap:Header>
                    <context xmlns="urn:zimbra">
                      <authToken>%s</authToken>
                    </context>
                  </soap:Header>
                  <soap:Body>
                    <SendInviteReplyRequest xmlns="urn:zimbraMail"
                        id="%s"
                        compNum="0"
                        verb="%s"
                        updateOrganizer="TRUE"/>
                  </soap:Body>
                </soap:Envelope>
                """.formatted(authToken, escapeXml(inviteId), verb);

        return postSoap(soap);
    }

    /**
     * Fetches an email attachment's binary content from Zimbra's REST
     * endpoint — {@code /service/home/~/?id=<msgId>&part=<partId>}.
     * Authenticates via the {@code ZM_AUTH_TOKEN} cookie so the service
     * account / user token we already hold in memory is honored without
     * exposing it to the browser.
     *
     * @return response entity with the raw bytes, preserving Zimbra's
     *         {@code Content-Type} and (when present) {@code Content-Disposition}
     */
    public ResponseEntity<byte[]> downloadAttachment(String authToken,
                                                     String messageId,
                                                     String partId) {
        // Build REST base from the SOAP URL: strip the "/service/soap" suffix
        String base = zimbraSoapUrl.endsWith("/service/soap")
                ? zimbraSoapUrl.substring(0, zimbraSoapUrl.length() - "/service/soap".length())
                : zimbraSoapUrl.replaceAll("/service/.*$", "");

        String url = base + "/service/home/~/?auth=co&id=" + messageId + "&part=" + partId;

        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.COOKIE, "ZM_AUTH_TOKEN=" + authToken);
        headers.setAccept(List.of(MediaType.ALL));

        try {
            return restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(headers), byte[].class);
        } catch (HttpClientErrorException | HttpServerErrorException ex) {
            log.warn("Zimbra attachment download failed {} msg={} part={}: {}",
                    ex.getStatusCode(), messageId, partId, ex.getMessage());
            throw new ZimbraException("Failed to download attachment: " + ex.getStatusCode());
        }
    }

    // ── internals ────────────────────────────────────────────────────────────

    private Document postSoap(String soapXml) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.TEXT_XML);
        headers.set("SOAPAction", "");

        HttpEntity<String> entity = new HttpEntity<>(soapXml, headers);
        log.debug("Sending SOAP request to {}", zimbraSoapUrl);

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    zimbraSoapUrl, HttpMethod.POST, entity, String.class);
            Document doc = parseXml(response.getBody());
            checkForFault(doc);
            return doc;
        } catch (HttpClientErrorException | HttpServerErrorException ex) {
            String body = ex.getResponseBodyAsString();
            log.warn("Zimbra HTTP error {}: {}", ex.getStatusCode(), body);
            // SOAP faults are often returned in 500 responses — try to parse
            try {
                Document doc = parseXml(body);
                checkForFault(doc);
            } catch (ZimbraException ze) {
                throw ze;
            } catch (Exception ignored) {
                // fall through to generic
            }
            throw new ZimbraException("Zimbra HTTP error " + ex.getStatusCode());
        }
    }

    private Document parseXml(String xml) {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(false);
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            DocumentBuilder builder = factory.newDocumentBuilder();
            return builder.parse(new ByteArrayInputStream(
                    xml.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new ZimbraException("Failed to parse Zimbra XML: " + e.getMessage(), e);
        }
    }

    private void checkForFault(Document doc) {
        NodeList faults = doc.getElementsByTagName("soap:Fault");
        if (faults.getLength() == 0) faults = doc.getElementsByTagName("Fault");
        if (faults.getLength() > 0) {
            String msg = getChildText((Element) faults.item(0), "faultstring");
            log.warn("Zimbra SOAP Fault: {}", msg);
            throw new ZimbraException("Zimbra SOAP Fault: " + msg);
        }
    }

    public static String getChildText(Element parent, String tagName) {
        NodeList list = parent.getElementsByTagName(tagName);
        if (list.getLength() > 0) return list.item(0).getTextContent().trim();
        return "";
    }

    private String escapeXml(String input) {
        if (input == null) return "";
        return input
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }
}
