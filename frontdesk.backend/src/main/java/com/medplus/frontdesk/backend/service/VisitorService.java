package com.medplus.frontdesk.backend.service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;

import com.medplus.frontdesk.backend.dto.visitor.CheckInGroupDto;
import com.medplus.frontdesk.backend.dto.visitor.CheckInVisitorDto;
import com.medplus.frontdesk.backend.dto.visitor.UpdateVisitorDto;
import com.medplus.frontdesk.backend.dto.visitor.VisitorDto;
import com.medplus.frontdesk.backend.dto.visitor.VisitorPageDto;
import com.medplus.frontdesk.backend.exceptions.VisitorNotFoundException;
import com.medplus.frontdesk.backend.repository.VisitorRepository;

import lombok.RequiredArgsConstructor;

/**
 * Handles visitor check-in, editing, checkout, and retrieval.
 *
 * Visitor ID format
 * ─────────────────
 *  Single visit : MED-V-{NNN}   e.g. MED-V-001
 *  Group  visit : MED-GV-{NNN}  e.g. MED-GV-001
 *
 * Group head rule
 * ───────────────
 *  • The group head row has groupHeadVisitorId = NULL.
 *  • Every other member in the group has groupHeadVisitorId set to the
 *    head's visitor ID.
 */
@Service
@RequiredArgsConstructor
public class VisitorService {

    private static final String PREFIX_SINGLE = "MED-V-";
    private static final String PREFIX_GROUP  = "MED-GV-";

    private final VisitorRepository visitorRepository;

    // ── Single check-in ───────────────────────────────────────────────────────

    /**
     * Checks in one visitor. Generates a {@code MED-V-NNN} ID automatically.
     */
    public VisitorDto checkInSingle(String createdBy, CheckInVisitorDto dto) {
        String visitorId = nextId(PREFIX_SINGLE);
        visitorRepository.insert(createdBy, visitorId, null, dto);
        return visitorRepository.findById(visitorId);
    }

    // ── Group check-in ────────────────────────────────────────────────────────

    /**
     * Checks in a group. Generates sequential {@code MED-GV-NNN} IDs for every
     * person in the group.
     */
    public List<VisitorDto> checkInGroup(String createdBy, CheckInGroupDto dto) {
        int base = visitorRepository.countByIdPrefix(PREFIX_GROUP);

        String headId = PREFIX_GROUP + String.format("%03d", base + 1);
        visitorRepository.insert(createdBy, headId, null, dto.getHead());

        List<VisitorDto> results = new ArrayList<>();
        results.add(visitorRepository.findById(headId));

        int offset = 1;
        for (CheckInVisitorDto member : dto.getMembers()) {
            String memberId = PREFIX_GROUP + String.format("%03d", base + 1 + offset);
            visitorRepository.insert(createdBy, memberId, headId, member);
            results.add(visitorRepository.findById(memberId));
            offset++;
        }

        return results;
    }

    // ── Edit visitor ──────────────────────────────────────────────────────────

    /**
     * Updates the editable (global) fields of an existing visitor.
     *
     * @throws VisitorNotFoundException if no visitor exists with the given ID
     */
    public VisitorDto updateVisitor(String modifiedBy, String visitorId, UpdateVisitorDto dto) {
        boolean updated = visitorRepository.update(visitorId, modifiedBy, dto);
        if (!updated) {
            throw new VisitorNotFoundException(visitorId);
        }
        return visitorRepository.findById(visitorId);
    }

    // ── Checkout ──────────────────────────────────────────────────────────────

    /**
     * Marks a currently checked-in visitor as checked out.
     *
     * @throws VisitorNotFoundException if the visitor does not exist or is already checked out
     */
    public VisitorDto checkOut(String modifiedBy, String visitorId) {
        boolean updated = visitorRepository.checkOut(visitorId, modifiedBy);
        if (!updated) {
            VisitorDto existing = visitorRepository.findById(visitorId);
            if (existing == null) {
                throw new VisitorNotFoundException(visitorId);
            }
            throw new IllegalStateException(
                    "Visitor " + visitorId + " is already checked out.");
        }
        return visitorRepository.findById(visitorId);
    }

    // ── List / search ─────────────────────────────────────────────────────────

    /**
     * Returns a paginated, optionally filtered list of visitors.
     *
     * @param search     substring search across fullName, identificationNumber,
     *                   govtId, cardNumber, and personToMeet; {@code null} = no filter
     * @param status     {@code "CheckedIn"}, {@code "CheckedOut"}, or {@code "ALL"} (default)
     * @param locationId filter by location; {@code null} = all locations
     * @param fromDate   inclusive start date on checkInTime; {@code null} = today
     * @param toDate     inclusive end date on checkInTime; {@code null} = today
     * @param page       0-based page index
     * @param pageSize   rows per page (capped at 100)
     */
    public VisitorPageDto getVisitors(String search, String status, String locationId,
                                      LocalDate fromDate, LocalDate toDate,
                                      int page, int pageSize) {
        pageSize = Math.min(pageSize, 100);
        int offset = page * pageSize;

        LocalDate from = fromDate != null ? fromDate : LocalDate.now();
        LocalDate to   = toDate   != null ? toDate   : LocalDate.now();
        if (to.isBefore(from)) to = from;

        List<VisitorDto> rows = visitorRepository.findAll(search, status, locationId, from, to, offset, pageSize);
        int totalRows  = visitorRepository.count(search, status, locationId, from, to);
        int totalPages = (int) Math.ceil((double) totalRows / pageSize);

        return new VisitorPageDto(rows, page, pageSize, totalRows, totalPages);
    }

    // ── ID generation ─────────────────────────────────────────────────────────

    private String nextId(String prefix) {
        int count = visitorRepository.countByIdPrefix(prefix);
        return prefix + String.format("%03d", count + 1);
    }
}
