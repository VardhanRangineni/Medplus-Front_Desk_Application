package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.config.DatabaseMigrationRunner;
import com.medplus.frontdesk_backend.dto.*;
import com.medplus.frontdesk_backend.repository.CardRepository;
import com.medplus.frontdesk_backend.security.AuthorizationHelper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class CardService {

    private static final int DEFAULT_CARD_COUNT = 100;

    private final CardRepository cardRepository;

    // ── Assignment ────────────────────────────────────────────────────────────

    /**
     * Atomically finds and assigns the next available card for a location.
     * Returns the assigned card code (e.g. "MSOH-VISITOR-7"), or empty if none available.
     */
    @Transactional
    public Optional<String> assignNextCard(String locationId, String visitorId) {
        Optional<CardDto> card = cardRepository.findNextAvailable(locationId);
        if (card.isEmpty()) {
            log.warn("No available cards for location {} — visitor {} will have no card assigned",
                     locationId, visitorId);
            return Optional.empty();
        }
        cardRepository.assignCard(card.get().getId(), visitorId);
        log.info("Card {} assigned to visitor {} at {}", card.get().getCardCode(), visitorId, locationId);
        return Optional.of(card.get().getCardCode());
    }

    /**
     * Releases a card when a visitor checks out.
     *
     * @param cardCode     the card code stored on the visitor record
     * @param cardReturned true if the visitor physically returned the card; false = mark MISSING
     */
    @Transactional
    public void releaseCard(String cardCode, boolean cardReturned) {
        if (cardCode == null || cardCode.isBlank()) return;
        if (cardReturned) {
            cardRepository.releaseCard(cardCode);
            log.info("Card {} returned and marked AVAILABLE", cardCode);
        } else {
            cardRepository.markMissing(cardCode);
            log.warn("Card {} NOT returned — marked MISSING", cardCode);
        }
    }

    // ── Stats / listing ───────────────────────────────────────────────────────

    public List<CardStatsDto> getStats(String locationId) {
        return cardRepository.getStats(locationId);
    }

    public PagedResponseDto<CardDto> getCards(String locationId, String status, int page, int size) {
        int offset = page * size;
        List<CardDto> rows = cardRepository.findCards(locationId, status, offset, size);
        long total = cardRepository.countCards(locationId, status);
        return PagedResponseDto.of(rows, page, size, total);
    }

    /** Restores a MISSING card to AVAILABLE (admin only). */
    @Transactional
    public void restoreCard(long cardId) {
        cardRepository.restoreCard(cardId);
        log.info("Card id={} restored to AVAILABLE", cardId);
    }

    // ── Card requests ─────────────────────────────────────────────────────────

    /** Submits a new card request and returns its generated id. */
    @Transactional
    public CardRequestDto submitRequest(CardRequestSubmitDto dto, String requestedBy) {
        validateRequestType(dto.getRequestType());
        long id = cardRepository.createRequest(
            dto.getLocationId(), dto.getRequestType(),
            dto.getQuantity(), dto.getNotes(), requestedBy);
        log.info("Card request {} created: type={} qty={} loc={} by={}",
                 id, dto.getRequestType(), dto.getQuantity(), dto.getLocationId(), requestedBy);
        return cardRepository.findRequests(dto.getLocationId(), null)
            .stream().filter(r -> r.getId() == id).findFirst()
            .orElseThrow();
    }

    public List<CardRequestDto> getRequests(String locationId, String status) {
        return cardRepository.findRequests(locationId, status);
    }

    /**
     * Fulfils a card request — generates the requested number of new cards and
     * marks the request as FULFILLED.
     * REGIONAL_ADMIN may only fulfil requests for their own location.
     */
    @Transactional
    public CardRequestDto fulfillRequest(long requestId, String fulfilledBy,
                                         AuthorizationHelper authHelper, Authentication auth) {
        Map<String, Object> row = cardRepository.findRequestById(requestId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                "Card request not found: " + requestId));

        if (!"PENDING".equals(row.get("status"))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Request is not PENDING (current status: " + row.get("status") + ")");
        }

        String locationId = (String) row.get("locationId");

        // REGIONAL_ADMIN can only fulfil requests for their own location
        if (authHelper != null && auth != null && !authHelper.isPrimaryAdmin(auth)) {
            authHelper.assertLocationAccess(auth, locationId);
        }

        int quantity = ((Number) row.get("quantity")).intValue();

        String abbrev = getLocationAbbrev(locationId);
        int    nextSeq = cardRepository.nextSequenceForLocation(locationId);
        cardRepository.insertCards(locationId, abbrev, nextSeq, quantity, requestId);

        cardRepository.updateRequestStatus(requestId, "FULFILLED", fulfilledBy);
        log.info("Card request {} fulfilled: {} cards added to {} by {}",
                 requestId, quantity, locationId, fulfilledBy);

        return cardRepository.findRequests(locationId, null)
            .stream().filter(r -> r.getId() == requestId).findFirst()
            .orElseThrow();
    }

    @Transactional
    public CardRequestDto cancelRequest(long requestId, String cancelledBy,
                                        AuthorizationHelper authHelper, Authentication auth) {
        Map<String, Object> row = cardRepository.findRequestById(requestId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                "Card request not found: " + requestId));

        if ("FULFILLED".equals(row.get("status"))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Cannot cancel a request that has already been fulfilled.");
        }

        String locationId = (String) row.get("locationId");

        // Non-admin users may only cancel requests for their own location
        if (authHelper != null && auth != null && !authHelper.isPrimaryAdmin(auth)) {
            authHelper.assertLocationAccess(auth, locationId);
        }

        cardRepository.updateRequestStatus(requestId, "CANCELLED", cancelledBy);
        return cardRepository.findRequests(locationId, null)
            .stream().filter(r -> r.getId() == requestId).findFirst()
            .orElseThrow();
    }

    // ── Called by SyncService when a new location is inserted ────────────────

    /**
     * Generates the default 100 starter cards for a brand-new location.
     * Idempotent — skipped if cards already exist for the location.
     */
    @Transactional
    public void ensureCardsForLocation(String locationId, String descriptiveName) {
        List<CardStatsDto> stats = cardRepository.getStats(locationId);
        if (!stats.isEmpty() && stats.get(0).getTotal() > 0) return;

        String abbrev = DatabaseMigrationRunner.locationAbbreviation(descriptiveName);
        long   reqId  = cardRepository.insertInitialRequest(locationId, DEFAULT_CARD_COUNT);
        cardRepository.insertCards(locationId, abbrev, 1, DEFAULT_CARD_COUNT, reqId);
        log.info("Generated {} starter cards (requestId={}) for new location: {} ({})",
                 DEFAULT_CARD_COUNT, reqId, locationId, abbrev);
    }

    /**
     * Returns all card codes belonging to a specific request batch.
     * Falls back to a fulfillment-time window query when cards were fulfilled before
     * requestId tracking existed (migration may have assigned them to the INITIAL batch).
     */
    public List<String> getCardsForRequest(long requestId) {
        List<String> codes = cardRepository.findCardCodesByRequestId(requestId);
        if (!codes.isEmpty()) return codes;

        // Fallback: locate the request and search by creation-time window
        Map<String, Object> req = cardRepository.findRequestById(requestId).orElse(null);
        if (req == null) return codes;

        String locationId = (String) req.get("locationId");
        Object fulfilledAtObj = req.get("fulfilledAt");
        if (locationId == null || fulfilledAtObj == null) return codes;

        java.sql.Timestamp fulfilledAt = fulfilledAtObj instanceof java.sql.Timestamp
            ? (java.sql.Timestamp) fulfilledAtObj
            : java.sql.Timestamp.valueOf(fulfilledAtObj.toString());

        log.info("Card request {} has no linked cards — falling back to time-window query (loc={}, fulfilledAt={})",
                 requestId, locationId, fulfilledAt);
        return cardRepository.findCardCodesByFulfillmentWindow(locationId, fulfilledAt);
    }

    /** Marks a fulfilled request's PDF as downloaded. */
    @Transactional
    public void markDownloaded(long requestId) {
        cardRepository.markDownloaded(requestId);
        log.info("Card request {} marked as downloaded", requestId);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private String getLocationAbbrev(String locationId) {
        // Re-use the same abbreviation logic from DatabaseMigrationRunner
        List<Map<String, Object>> rows = cardRepository.findCards(locationId, null, 0, 1)
            .stream()
            .map(c -> Map.<String, Object>of("descriptiveName", c.getLocationName()))
            .toList();
        if (!rows.isEmpty()) {
            return DatabaseMigrationRunner.locationAbbreviation(
                (String) rows.get(0).get("descriptiveName"));
        }
        // Fall back to stats which always joins locationmaster
        List<CardStatsDto> stats = cardRepository.getStats(locationId);
        if (!stats.isEmpty()) {
            return DatabaseMigrationRunner.locationAbbreviation(stats.get(0).getLocationName());
        }
        return locationId.replaceAll("[^A-Z]", "");
    }

    private static void validateRequestType(String type) {
        if (!"ADDITIONAL".equalsIgnoreCase(type) && !"REPLACEMENT".equalsIgnoreCase(type)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "requestType must be ADDITIONAL or REPLACEMENT");
        }
    }
}
