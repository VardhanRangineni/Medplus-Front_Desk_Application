package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.dto.PersonToMeetDto;
import com.medplus.frontdesk_backend.dto.VisitorMemberDto;
import com.medplus.frontdesk_backend.dto.VisitorMemberRequestDto;
import com.medplus.frontdesk_backend.dto.VisitorRequestDto;
import com.medplus.frontdesk_backend.dto.VisitorResponseDto;
import com.medplus.frontdesk_backend.model.UserManagement;
import com.medplus.frontdesk_backend.model.VisitStatus;
import com.medplus.frontdesk_backend.model.VisitType;
import com.medplus.frontdesk_backend.model.Visitor;
import com.medplus.frontdesk_backend.model.VisitorMember;
import com.medplus.frontdesk_backend.repository.UserRepository;
import com.medplus.frontdesk_backend.repository.VisitorRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class VisitorService {

    private final VisitorRepository visitorRepository;
    private final UserRepository    userRepository;

    // ── Create ────────────────────────────────────────────────────────────────

    /**
     * Creates a new check-in entry (visitor or employee).
     * The locationId is resolved from the authenticated user's assigned location.
     */
    @Transactional
    public VisitorResponseDto checkIn(VisitorRequestDto req, String createdBy) {

        VisitType visitType = parseVisitType(req.getVisitType());

        // Validate: GROUP visits must include at least one member
        if (visitType == VisitType.GROUP
                && (req.getMembers() == null || req.getMembers().isEmpty())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "GROUP visits must include at least one member.");
        }

        // Resolve person-to-meet details
        PersonToMeetDto person = visitorRepository.findPersonById(req.getPersonToMeetId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Person to meet not found: " + req.getPersonToMeetId()));

        // Resolve the caller's location
        String locationId = getUserLocation(createdBy);

        // Generate visitor ID
        int seq = visitorRepository.nextVisitorSequence(visitType);
        String visitorId = buildVisitorId(visitType, seq);

        Visitor visitor = Visitor.builder()
                .visitorId(visitorId)
                .visitType(visitType)
                .entryType(req.getEntryType().toUpperCase())
                .name(req.getName().trim())
                .mobile(req.getMobile() != null ? req.getMobile().trim() : null)
                .empId(req.getEmpId() != null ? req.getEmpId().trim() : null)
                .status(VisitStatus.CHECKED_IN)
                .personToMeet(person.getId())
                .personName(person.getName())
                .department(person.getDepartment())
                .locationId(locationId)
                .cardNumber(req.getCardNumber())
                .checkInTime(LocalDateTime.now())
                .reasonForVisit(req.getReasonForVisit())
                .createdBy(createdBy)
                .build();

        visitorRepository.insertVisitor(visitor);
        log.info("Check-in created: {} ({}) by {}", visitorId, req.getName(), createdBy);

        // Insert members for group visits
        if (visitType == VisitType.GROUP && req.getMembers() != null) {
            int memberSeq = visitorRepository.nextMemberSequence();
            for (VisitorMemberRequestDto m : req.getMembers()) {
                String memberId = String.format("MED-GM-%04d", memberSeq++);
                visitorRepository.insertMember(VisitorMember.builder()
                        .memberId(memberId)
                        .visitorId(visitorId)
                        .name(m.getName().trim())
                        .cardNumber(m.getCardNumber())
                        .status(VisitStatus.CHECKED_IN)
                        .build());
                log.info("Member registered: {} for group visit {}", memberId, visitorId);
            }
        }

        return buildResponse(visitor);
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    /**
     * Returns all entries for the authenticated user's location on the given date.
     * Defaults to today if date is null.
     */
    public List<VisitorResponseDto> getEntries(String callerEmployeeId, LocalDate date) {
        String locationId = getUserLocation(callerEmployeeId);
        LocalDate queryDate = date != null ? date : LocalDate.now();
        List<Visitor> visitors = visitorRepository.findByLocationAndDate(locationId, queryDate);
        return visitors.stream().map(this::buildResponse).toList();
    }

    /**
     * Full-text search over entries for the caller's location + date.
     */
    public List<VisitorResponseDto> searchEntries(String callerEmployeeId, LocalDate date, String query) {
        if (query == null || query.isBlank()) return getEntries(callerEmployeeId, date);
        String locationId = getUserLocation(callerEmployeeId);
        LocalDate queryDate = date != null ? date : LocalDate.now();
        return visitorRepository.searchByLocationAndDate(locationId, queryDate, query)
                .stream().map(this::buildResponse).toList();
    }

    // ── Update ────────────────────────────────────────────────────────────────

    /**
     * Updates visitor details (name, mobile/empId, personToMeet, card, reason).
     * Does not change status — use checkout endpoints for that.
     */
    @Transactional
    public VisitorResponseDto updateEntry(String visitorId, VisitorRequestDto req, String callerEmployeeId) {
        Visitor existing = visitorRepository.findById(visitorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Visitor entry not found: " + visitorId));

        PersonToMeetDto person = visitorRepository.findPersonById(req.getPersonToMeetId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Person to meet not found: " + req.getPersonToMeetId()));

        existing.setName(req.getName().trim());
        existing.setMobile(req.getMobile() != null ? req.getMobile().trim() : null);
        existing.setEmpId(req.getEmpId() != null ? req.getEmpId().trim() : null);
        existing.setPersonToMeet(person.getId());
        existing.setPersonName(person.getName());
        existing.setDepartment(person.getDepartment());
        existing.setCardNumber(req.getCardNumber());
        existing.setReasonForVisit(req.getReasonForVisit());
        existing.setCreatedBy(callerEmployeeId);

        visitorRepository.updateVisitor(existing);
        log.info("Entry updated: {} by {}", visitorId, callerEmployeeId);

        return buildResponse(existing);
    }

    // ── Check-out ─────────────────────────────────────────────────────────────

    /** Checks out a main visitor/employee entry. */
    @Transactional
    public VisitorResponseDto checkOut(String visitorId, String callerEmployeeId) {
        Visitor existing = visitorRepository.findById(visitorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Visitor entry not found: " + visitorId));

        if (existing.getStatus() == VisitStatus.CHECKED_OUT) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Entry is already checked out: " + visitorId);
        }

        LocalDateTime now = LocalDateTime.now();
        visitorRepository.checkOutVisitor(visitorId, now, callerEmployeeId);

        existing.setStatus(VisitStatus.CHECKED_OUT);
        existing.setCheckOutTime(now);

        log.info("Checked out: {} by {}", visitorId, callerEmployeeId);
        return buildResponse(existing);
    }

    /** Checks out a single member within a group visit. */
    @Transactional
    public VisitorMemberDto checkOutMember(String visitorId, String memberId, String callerEmployeeId) {
        visitorRepository.findById(visitorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Visitor entry not found: " + visitorId));

        VisitorMember member = visitorRepository.findMemberById(memberId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Member not found: " + memberId));

        if (!member.getVisitorId().equals(visitorId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Member does not belong to this visitor entry.");
        }
        if (member.getStatus() == VisitStatus.CHECKED_OUT) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Member is already checked out: " + memberId);
        }

        LocalDateTime now = LocalDateTime.now();
        visitorRepository.checkOutMember(memberId, now);

        log.info("Member checked out: {} (group: {}) by {}", memberId, visitorId, callerEmployeeId);

        return VisitorMemberDto.builder()
                .id(memberId)
                .name(member.getName())
                .card(member.getCardNumber())
                .status(VisitStatus.CHECKED_OUT.toLabel())
                .build();
    }

    // ── Person-to-meet search ─────────────────────────────────────────────────

    /**
     * Searches employees at the caller's location by name, employee ID, or phone.
     */
    public List<PersonToMeetDto> searchPersonsToMeet(String callerEmployeeId, String query) {
        if (query == null || query.isBlank()) return List.of();
        String locationId = getUserLocation(callerEmployeeId);
        return visitorRepository.searchPersonsToMeet(locationId, query);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private String getUserLocation(String employeeId) {
        return userRepository.findByEmployeeId(employeeId)
                .map(UserManagement::getLocation)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                        "User not found in management records: " + employeeId));
    }

    private static VisitType parseVisitType(String raw) {
        try {
            return VisitType.valueOf(raw.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid visitType '" + raw + "'. Must be INDIVIDUAL or GROUP.");
        }
    }

    private static String buildVisitorId(VisitType visitType, int seq) {
        String prefix = visitType == VisitType.GROUP ? "MED-GV" : "MED-V";
        return String.format("%s-%04d", prefix, seq);
    }

    /** Builds a full VisitorResponseDto (with members list loaded from DB). */
    private VisitorResponseDto buildResponse(Visitor v) {
        List<VisitorMemberDto> members = visitorRepository
                .findMembersByVisitorId(v.getVisitorId())
                .stream()
                .map(m -> VisitorMemberDto.builder()
                        .id(m.getMemberId())
                        .name(m.getName())
                        .card(m.getCardNumber())
                        .status(m.getStatus().toLabel())
                        .build())
                .toList();

        return VisitorResponseDto.builder()
                .id(v.getVisitorId())
                .type(v.getEntryType())
                .visitType(v.getVisitType().name())
                .name(v.getName())
                .mobile(v.getMobile())
                .empId(v.getEmpId())
                .status(v.getStatus().toLabel())
                .personToMeet(v.getPersonName())
                .personToMeetId(v.getPersonToMeet())
                .department(v.getDepartment())
                .locationId(v.getLocationId())
                .card(v.getCardNumber())
                .checkIn(v.getCheckInTime())
                .checkOut(v.getCheckOutTime())
                .reasonForVisit(v.getReasonForVisit())
                .members(members)
                .build();
    }
}
