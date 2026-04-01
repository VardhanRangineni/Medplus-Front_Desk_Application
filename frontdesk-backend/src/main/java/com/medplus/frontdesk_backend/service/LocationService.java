package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.dto.LocationDto;
import com.medplus.frontdesk_backend.dto.PagedResponseDto;
import com.medplus.frontdesk_backend.exception.UnauthorizedOperationException;
import com.medplus.frontdesk_backend.model.Location;
import com.medplus.frontdesk_backend.repository.LocationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class LocationService {

    private final LocationRepository locationRepository;
    private final SyncService syncService;

    /**
     * Returns all locations from the local locationmaster table (used by sync response).
     */
    public List<LocationDto> getAllLocations() {
        return locationRepository.findAll().stream()
                .map(this::toDto)
                .toList();
    }

    /**
     * Returns a single page of locations, optionally filtered by a search term.
     *
     * @param search case-insensitive substring across LocationId, name, and city
     * @param page   0-based page index
     * @param size   records per page
     */
    public PagedResponseDto<LocationDto> getLocationsPaged(String search, int page, int size) {
        int    offset = page * size;
        String q      = (search != null && !search.isBlank()) ? search : null;
        List<LocationDto> rows  = locationRepository.findAllPaged(q, offset, size).stream()
                .map(this::toDto)
                .toList();
        long total = locationRepository.countAll(q);
        return PagedResponseDto.of(rows, page, size, total);
    }

    /**
     * Triggers a full sync from the external HR API, then returns all
     * locations from the now-updated local locationmaster table.
     */
    public List<LocationDto> syncAndGetLocations(String triggeredBy) {
        log.info("Location sync requested by: {}", triggeredBy);
        syncService.sync(triggeredBy);
        return getAllLocations();
    }

    /**
     * Type-ahead search over locationmaster by descriptiveName or LocationId.
     * Returns an empty list if the query is blank.
     */
    public List<LocationDto> searchLocations(String query) {
        if (query == null || query.isBlank()) return List.of();
        return locationRepository.searchByQuery(query).stream()
                .map(this::toDto)
                .toList();
    }

    /**
     * Toggles the active/inactive status of a location.
     *
     * @param locationId the LocationId of the location
     * @param active     true = CONFIGURED (active), false = NOTCONFIGURED (inactive)
     */
    public LocationDto updateStatus(String locationId, boolean active) {
        String newStatus = active ? "CONFIGURED" : "NOTCONFIGURED";
        int updated = locationRepository.updateStatus(locationId, newStatus);
        if (updated == 0) {
            throw new UnauthorizedOperationException("Location not found: " + locationId);
        }
        log.info("Location {} status updated to {}", locationId, newStatus);
        return locationRepository.findAll().stream()
                .filter(l -> locationId.equals(l.getLocationId()))
                .findFirst()
                .map(this::toDto)
                .orElseThrow(() -> new UnauthorizedOperationException("Location not found after update: " + locationId));
    }

    private LocationDto toDto(Location loc) {
        String status = loc.getStatus();
        boolean active = "CONFIGURED".equalsIgnoreCase(status) || "ACTIVE".equalsIgnoreCase(status);
        return LocationDto.builder()
                .code(loc.getLocationId())
                .name(loc.getDescriptiveName())
                .address(loc.getAddress())
                .city(loc.getCity())
                .state(loc.getState())
                .status(active)
                .build();
    }
}
