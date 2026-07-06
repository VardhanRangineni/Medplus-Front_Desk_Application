package com.medplus.frontdesk_backend.controller;

import com.medplus.frontdesk_backend.dto.ApiResponse;
import com.medplus.frontdesk_backend.dto.LocationDto;
import com.medplus.frontdesk_backend.service.LocationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/locations")
@RequiredArgsConstructor
public class LocationController {

    private final LocationService locationService;

    @GetMapping("/active")
    public ResponseEntity<ApiResponse<List<LocationDto>>> getActiveLocations() {
        List<LocationDto> locations = locationService.getActiveLocations();
        return ResponseEntity.ok(ApiResponse.success("Active locations retrieved.", locations));
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<List<LocationDto>>> searchLocations(
            @RequestParam(defaultValue = "") String q) {
        List<LocationDto> results = locationService.searchLocations(q);
        return ResponseEntity.ok(ApiResponse.success("Search results.", results));
    }
}
