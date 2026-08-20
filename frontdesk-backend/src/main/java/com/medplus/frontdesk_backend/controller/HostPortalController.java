package com.medplus.frontdesk_backend.controller;

import com.medplus.frontdesk_backend.dto.ApiResponse;
import com.medplus.frontdesk_backend.dto.HostPortalDto;
import com.medplus.frontdesk_backend.dto.HostPortalMemberDecisionsRequestDto;
import com.medplus.frontdesk_backend.dto.HostPortalRejectRequestDto;
import com.medplus.frontdesk_backend.service.HostPortalService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public (no-login) Key Management portal — visits for a host portal token.
 */
@RestController
@RequestMapping("/api/key-management/public")
@RequiredArgsConstructor
public class HostPortalController {

    private final HostPortalService hostPortalService;

    @GetMapping("/portal/{portalToken}")
    public ResponseEntity<ApiResponse<HostPortalDto>> getPortal(@PathVariable String portalToken) {
        HostPortalDto portal = hostPortalService.getPortal(portalToken);
        return ResponseEntity.ok(ApiResponse.success("Portal loaded.", portal));
    }

    @PostMapping("/portal/{portalToken}/visits/{visitorId}/approve")
    public ResponseEntity<ApiResponse<HostPortalDto.HostPortalVisitDto>> approve(
            @PathVariable String portalToken,
            @PathVariable String visitorId) {
        HostPortalDto.HostPortalVisitDto visit = hostPortalService.approve(portalToken, visitorId);
        return ResponseEntity.ok(ApiResponse.success("Visit approved.", visit));
    }

    @PostMapping("/portal/{portalToken}/visits/{visitorId}/reject")
    public ResponseEntity<ApiResponse<HostPortalDto.HostPortalVisitDto>> reject(
            @PathVariable String portalToken,
            @PathVariable String visitorId,
            @RequestBody(required = false) HostPortalRejectRequestDto body) {
        String remarks = body != null ? body.getRemarks() : null;
        HostPortalDto.HostPortalVisitDto visit = hostPortalService.reject(portalToken, visitorId, remarks);
        return ResponseEntity.ok(ApiResponse.success("Visit rejected.", visit));
    }

    @PostMapping("/portal/{portalToken}/groups/{groupId}/approve")
    public ResponseEntity<ApiResponse<HostPortalDto.HostPortalVisitDto>> approveGroup(
            @PathVariable String portalToken,
            @PathVariable String groupId) {
        HostPortalDto.HostPortalVisitDto visit = hostPortalService.approveGroup(portalToken, groupId);
        return ResponseEntity.ok(ApiResponse.success("Group visit approved.", visit));
    }

    @PostMapping("/portal/{portalToken}/groups/{groupId}/reject")
    public ResponseEntity<ApiResponse<HostPortalDto.HostPortalVisitDto>> rejectGroup(
            @PathVariable String portalToken,
            @PathVariable String groupId,
            @RequestBody(required = false) HostPortalRejectRequestDto body) {
        String remarks = body != null ? body.getRemarks() : null;
        HostPortalDto.HostPortalVisitDto visit = hostPortalService.rejectGroup(portalToken, groupId, remarks);
        return ResponseEntity.ok(ApiResponse.success("Group visit rejected.", visit));
    }

    @PostMapping("/portal/{portalToken}/groups/{groupId}/members/decision")
    public ResponseEntity<ApiResponse<HostPortalDto.HostPortalVisitDto>> decideGroupMembers(
            @PathVariable String portalToken,
            @PathVariable String groupId,
            @RequestBody HostPortalMemberDecisionsRequestDto body) {
        HostPortalDto.HostPortalVisitDto visit = hostPortalService.decideGroupMembers(portalToken, groupId, body);
        return ResponseEntity.ok(ApiResponse.success("Member decisions applied.", visit));
    }
}
