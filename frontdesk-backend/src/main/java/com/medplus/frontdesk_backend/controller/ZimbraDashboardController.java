package com.medplus.frontdesk_backend.controller;

import com.medplus.frontdesk_backend.dto.zimbra.ZimbraDashboardResponseDto;
import com.medplus.frontdesk_backend.service.ZimbraDashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/zimbra")
@RequiredArgsConstructor
public class ZimbraDashboardController {

    private final ZimbraDashboardService zimbraDashboardService;

    @GetMapping("/dashboard")
    public ResponseEntity<ZimbraDashboardResponseDto> getDashboard() {
        return ResponseEntity.ok(zimbraDashboardService.getDashboard());
    }
}
