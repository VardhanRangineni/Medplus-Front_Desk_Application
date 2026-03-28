package com.medplus.frontdesk.backend.repository;

import java.util.List;

import com.medplus.frontdesk.backend.dto.location.CreateLocationDto;
import com.medplus.frontdesk.backend.dto.location.LocationDto;
import com.medplus.frontdesk.backend.dto.location.UpdateLocationDto;

public interface LocationRepository {

    /** Paginated + filtered list of all locations. */
    List<LocationDto> findAll(String search, String status, int offset, int limit);

    /** Total count for the same filters (used for pagination metadata). */
    int countAll(String search, String status);

    /** Insert a single new location with the given pre-generated locationId. */
    void insert(String createdBy, String locationId, CreateLocationDto dto);

    /** Count existing locations whose ID starts with the given prefix (used for ID generation). */
    int countByIdPrefix(String prefix);

    /** Returns true when a row with the given locationId already exists. */
    boolean existsById(String locationId);

    /** Fetches a single location by its ID, or null if not found. */
    LocationDto findById(String locationId);

    /** Updates mutable fields of an existing location. */
    void update(String locationId, String modifiedBy, UpdateLocationDto dto);
}
