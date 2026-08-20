package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.dto.HostPortalDto;
import com.medplus.frontdesk_backend.dto.HostPortalMemberDecisionsRequestDto;
import com.medplus.frontdesk_backend.dto.KeyManagementContactDto;
import com.medplus.frontdesk_backend.model.VisitStatus;
import com.medplus.frontdesk_backend.model.Visitor;
import com.medplus.frontdesk_backend.repository.KeyManagementRepository;
import com.medplus.frontdesk_backend.repository.VisitorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class HostPortalService {

    private final KeyManagementRepository keyManagementRepository;
    private final VisitorRepository visitorRepository;

    public HostPortalDto getPortal(String portalToken) {
        KeyManagementContactDto contact = requireActiveContact(portalToken);

        LocalDateTime since = LocalDate.now().atStartOfDay();
        List<Visitor> visitors = visitorRepository.findTodayByPersonToMeetPhone(
                contact.getMobile(), since, 100);

        String hostName = StringUtils.hasText(contact.getDisplayName())
                ? contact.getDisplayName()
                : "Host";

        return HostPortalDto.builder()
                .hostName(hostName)
                .mobileMasked(maskPhone(contact.getMobile()))
                .visits(collapseVisits(visitors))
                .build();
    }

    @Transactional
    public HostPortalDto.HostPortalVisitDto approve(String portalToken, String visitorId) {
        KeyManagementContactDto contact = requireActiveContact(portalToken);
        String phone = HostNotifyService.normalizeMobile(contact.getMobile());
        if (phone == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid host mobile.");
        }
        int updated = visitorRepository.approvePendingVisit(visitorId, phone);
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Visit is not pending approval or does not belong to this host.");
        }
        return loadVisitForHost(visitorId, phone);
    }

    @Transactional
    public HostPortalDto.HostPortalVisitDto reject(String portalToken, String visitorId, String remarks) {
        KeyManagementContactDto contact = requireActiveContact(portalToken);
        String phone = HostNotifyService.normalizeMobile(contact.getMobile());
        if (phone == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid host mobile.");
        }
        String cleaned = cleanRemarks(remarks);
        int updated = visitorRepository.rejectPendingVisit(visitorId, phone, cleaned);
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Visit is not pending approval or does not belong to this host.");
        }
        return loadVisitForHost(visitorId, phone);
    }

    @Transactional
    public HostPortalDto.HostPortalVisitDto approveGroup(String portalToken, String groupId) {
        KeyManagementContactDto contact = requireActiveContact(portalToken);
        String phone = HostNotifyService.normalizeMobile(contact.getMobile());
        if (phone == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid host mobile.");
        }
        requireOwnedGroup(groupId, phone);
        int updated = visitorRepository.approvePendingVisitsByGroupId(groupId, phone);
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Group has no pending visits for this host.");
        }
        return loadGroupForHost(groupId, phone);
    }

    @Transactional
    public HostPortalDto.HostPortalVisitDto rejectGroup(String portalToken, String groupId, String remarks) {
        KeyManagementContactDto contact = requireActiveContact(portalToken);
        String phone = HostNotifyService.normalizeMobile(contact.getMobile());
        if (phone == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid host mobile.");
        }
        requireOwnedGroup(groupId, phone);
        String cleaned = cleanRemarks(remarks);
        int updated = visitorRepository.rejectPendingVisitsByGroupId(groupId, phone, cleaned);
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Group has no pending visits for this host.");
        }
        return loadGroupForHost(groupId, phone);
    }

    /**
     * Partial approve/reject for selected group members.
     * Only PENDING_APPROVAL rows change; others are skipped.
     */
    @Transactional
    public HostPortalDto.HostPortalVisitDto decideGroupMembers(
            String portalToken,
            String groupId,
            HostPortalMemberDecisionsRequestDto request) {
        KeyManagementContactDto contact = requireActiveContact(portalToken);
        String phone = HostNotifyService.normalizeMobile(contact.getMobile());
        if (phone == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid host mobile.");
        }
        requireOwnedGroup(groupId, phone);

        if (request == null || request.getDecisions() == null || request.getDecisions().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "At least one decision is required.");
        }

        List<Visitor> members = visitorRepository.findByGroupId(groupId.trim());
        Map<String, Visitor> byId = new LinkedHashMap<>();
        for (Visitor m : members) {
            byId.put(m.getVisitorId(), m);
        }

        List<String> approveIds = new ArrayList<>();
        List<String> rejectIds = new ArrayList<>();
        String rejectRemarks = null;

        for (HostPortalMemberDecisionsRequestDto.MemberDecision d : request.getDecisions()) {
            if (d == null || !StringUtils.hasText(d.getVisitorId()) || !StringUtils.hasText(d.getDecision())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Each decision needs visitorId and decision.");
            }
            String visitorId = d.getVisitorId().trim();
            Visitor member = byId.get(visitorId);
            if (member == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Visitor " + visitorId + " is not part of this group.");
            }
            String memberPhone = HostNotifyService.normalizeMobile(member.getPersonToMeetPhone());
            if (memberPhone == null || !memberPhone.equals(phone)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Visitor " + visitorId + " does not belong to this host.");
            }
            if (member.getStatus() != VisitStatus.PENDING_APPROVAL) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Visitor " + visitorId + " is not pending approval (status="
                                + (member.getStatus() != null ? member.getStatus().name() : "?") + ").");
            }

            String decision = d.getDecision().trim().toUpperCase();
            if ("APPROVED".equals(decision) || "APPROVE".equals(decision)) {
                approveIds.add(visitorId);
            } else if ("REJECTED".equals(decision) || "REJECT".equals(decision)) {
                rejectIds.add(visitorId);
                if (rejectRemarks == null) {
                    rejectRemarks = cleanRemarks(d.getRemarks());
                }
            } else {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Invalid decision '" + d.getDecision() + "'. Use APPROVED or REJECTED.");
            }
        }

        int updated = 0;
        if (!approveIds.isEmpty()) {
            updated += visitorRepository.approvePendingMembersByIds(groupId.trim(), phone, approveIds);
        }
        if (!rejectIds.isEmpty()) {
            updated += visitorRepository.rejectPendingMembersByIds(
                    groupId.trim(), phone, rejectIds, rejectRemarks);
        }
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "No pending members were updated.");
        }
        return loadGroupForHost(groupId, phone);
    }

    private KeyManagementContactDto requireActiveContact(String portalToken) {
        if (!StringUtils.hasText(portalToken)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Invalid approval link.");
        }
        return keyManagementRepository.findActiveByPortalToken(portalToken.trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invalid approval link."));
    }

    private void requireOwnedGroup(String groupId, String hostMobile) {
        if (!StringUtils.hasText(groupId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "groupId is required.");
        }
        List<Visitor> members = visitorRepository.findByGroupId(groupId.trim());
        if (members.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Group not found.");
        }
        boolean owned = members.stream().anyMatch(v -> {
            String visitPhone = HostNotifyService.normalizeMobile(v.getPersonToMeetPhone());
            return visitPhone != null && visitPhone.equals(hostMobile);
        });
        if (!owned) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Group does not belong to this host.");
        }
    }

    private HostPortalDto.HostPortalVisitDto loadVisitForHost(String visitorId, String hostMobile) {
        Visitor v = visitorRepository.findById(visitorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Visit not found."));
        String visitPhone = HostNotifyService.normalizeMobile(v.getPersonToMeetPhone());
        if (visitPhone == null || !visitPhone.equals(hostMobile)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Visit does not belong to this host.");
        }
        if (StringUtils.hasText(v.getGroupId())) {
            return toGroupVisit(visitorRepository.findByGroupId(v.getGroupId()));
        }
        return toIndividualVisit(v);
    }

    private HostPortalDto.HostPortalVisitDto loadGroupForHost(String groupId, String hostMobile) {
        List<Visitor> members = visitorRepository.findByGroupId(groupId.trim());
        if (members.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Group not found.");
        }
        String visitPhone = HostNotifyService.normalizeMobile(members.get(0).getPersonToMeetPhone());
        if (visitPhone == null || !visitPhone.equals(hostMobile)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Group does not belong to this host.");
        }
        return toGroupVisit(members);
    }

    private List<HostPortalDto.HostPortalVisitDto> collapseVisits(List<Visitor> visitors) {
        Map<String, Boolean> seenGroups = new LinkedHashMap<>();
        List<HostPortalDto.HostPortalVisitDto> result = new ArrayList<>();

        for (Visitor v : visitors) {
            if (StringUtils.hasText(v.getGroupId())) {
                seenGroups.putIfAbsent(v.getGroupId(), Boolean.TRUE);
            } else {
                result.add(toIndividualVisit(v));
            }
        }
        for (String groupId : seenGroups.keySet()) {
            // Full member list (includes rejected) for review UI.
            result.add(toGroupVisit(visitorRepository.findByGroupId(groupId)));
        }

        result.sort((a, b) -> {
            int sa = statusRank(a.getStatus());
            int sb = statusRank(b.getStatus());
            if (sa != sb) return Integer.compare(sa, sb);
            LocalDateTime ta = a.getCheckInTime();
            LocalDateTime tb = b.getCheckInTime();
            if (ta == null && tb == null) return 0;
            if (ta == null) return 1;
            if (tb == null) return -1;
            return tb.compareTo(ta);
        });
        return result;
    }

    private static int statusRank(String status) {
        if ("pending-approval".equals(status)) return 0;
        if ("approved".equals(status)) return 1;
        return 2;
    }

    private HostPortalDto.HostPortalVisitDto toIndividualVisit(Visitor v) {
        String locationName = visitorRepository.findLocationName(v.getLocationId()).orElse(null);
        VisitStatus status = v.getStatus();
        return HostPortalDto.HostPortalVisitDto.builder()
                .groupId(null)
                .memberCount(null)
                .members(null)
                .visitorId(v.getVisitorId())
                .visitorName(v.getName())
                .visitorMobile(v.getMobile())
                .companyName(v.getCompanyName())
                .reasonForVisit(v.getReasonForVisit())
                .department(v.getDepartment())
                .locationId(v.getLocationId())
                .locationName(locationName)
                .personName(v.getPersonName())
                .checkInTime(v.getCheckInTime())
                .approvedAt(v.getApprovedAt())
                .rejectedAt(v.getRejectedAt())
                .status(status != null ? status.toLabel() : null)
                .entryType(v.getEntryType() != null ? v.getEntryType().name() : null)
                .rejectionRemarks(v.getRejectionRemarks())
                .build();
    }

    private HostPortalDto.HostPortalVisitDto toGroupVisit(List<Visitor> members) {
        if (members == null || members.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Group not found.");
        }
        Visitor primary = members.stream()
                .filter(v -> v.getStatus() == VisitStatus.PENDING_APPROVAL)
                .findFirst()
                .orElseGet(() -> members.stream()
                        .filter(v -> v.getStatus() == VisitStatus.APPROVED)
                        .findFirst()
                        .orElse(members.get(0)));

        boolean anyPending = members.stream().anyMatch(v -> v.getStatus() == VisitStatus.PENDING_APPROVAL);
        boolean anyApproved = members.stream().anyMatch(v ->
                v.getStatus() == VisitStatus.APPROVED || v.getStatus() == VisitStatus.CHECKED_IN);
        boolean anyRejected = members.stream().anyMatch(v -> v.getStatus() == VisitStatus.REJECTED);
        long pendingCount = members.stream().filter(v -> v.getStatus() == VisitStatus.PENDING_APPROVAL).count();

        String statusLabel;
        if (anyPending) {
            statusLabel = VisitStatus.PENDING_APPROVAL.toLabel();
        } else if (anyApproved && anyRejected) {
            statusLabel = "mixed";
        } else if (anyApproved) {
            statusLabel = VisitStatus.APPROVED.toLabel();
        } else {
            statusLabel = primary.getStatus() != null ? primary.getStatus().toLabel() : null;
        }

        String locationName = visitorRepository.findLocationName(primary.getLocationId()).orElse(null);
        List<HostPortalDto.HostPortalMemberDto> memberDtos = members.stream()
                .map(m -> HostPortalDto.HostPortalMemberDto.builder()
                        .visitorId(m.getVisitorId())
                        .visitorName(m.getName())
                        .visitorMobile(m.getMobile())
                        .empId(m.getEmpId())
                        .status(m.getStatus() != null ? m.getStatus().toLabel() : null)
                        .entryType(m.getEntryType() != null ? m.getEntryType().name() : null)
                        .build())
                .toList();

        return HostPortalDto.HostPortalVisitDto.builder()
                .groupId(primary.getGroupId())
                .memberCount(members.size())
                .pendingCount((int) pendingCount)
                .members(memberDtos)
                .visitorId(null)
                .visitorName("Group visit (" + members.size() + ")")
                .visitorMobile(null)
                .companyName(primary.getCompanyName())
                .reasonForVisit(primary.getReasonForVisit())
                .department(primary.getDepartment())
                .locationId(primary.getLocationId())
                .locationName(locationName)
                .personName(primary.getPersonName())
                .checkInTime(primary.getCheckInTime())
                .approvedAt(primary.getApprovedAt())
                .rejectedAt(primary.getRejectedAt())
                .status(statusLabel)
                .entryType(primary.getEntryType() != null ? primary.getEntryType().name() : null)
                .rejectionRemarks(primary.getRejectionRemarks())
                .build();
    }

    private static String cleanRemarks(String remarks) {
        String cleaned = StringUtils.hasText(remarks) ? remarks.trim() : null;
        if (cleaned != null && cleaned.length() > 500) {
            cleaned = cleaned.substring(0, 500);
        }
        return cleaned;
    }

    private static String maskPhone(String phone) {
        if (phone == null || phone.length() < 4) return "****";
        return phone.substring(0, 2) + "****" + phone.substring(phone.length() - 2);
    }
}
