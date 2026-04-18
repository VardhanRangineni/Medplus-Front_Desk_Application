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
