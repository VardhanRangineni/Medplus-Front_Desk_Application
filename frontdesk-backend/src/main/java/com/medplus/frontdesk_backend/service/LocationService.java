package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.dto.LocationDto;
import com.medplus.frontdesk_backend.repository.LocationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class LocationService {

    private final LocationRepository locationRepository;

    public List<LocationDto> getActiveLocations() {
        return locationRepository.findAllActive();
    }

    public List<LocationDto> searchLocations(String query) {
        if (query == null || query.isBlank()) return List.of();
        return locationRepository.searchByQuery(query);
    }
}
