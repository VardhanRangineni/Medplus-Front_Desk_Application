package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.client.ExternalApiClient;
import com.medplus.frontdesk_backend.dto.SyncResultDto;
import com.medplus.frontdesk_backend.dto.external.ExternalEmployeeDto;
import com.medplus.frontdesk_backend.dto.external.ExternalLocationDto;
import com.medplus.frontdesk_backend.repository.SyncRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class SyncService {

    private final ExternalApiClient externalApiClient;
    private final SyncRepository    syncRepository;
    private final CardService       cardService;

    private static final DateTimeFormatter FORMATTER =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    /**
     * Pulls fresh data from the external HR/ERP API and upserts it into
     * locationmaster and usermaster.
     *
     * Rules:
     *  - locationmaster.status   → NEVER overwritten (app-owned)
     *  - locationmaster.createdBy/createdAt → set only on first insert
     *  - usermaster.createdBy/createdAt     → set only on first insert
     *  - modifiedBy is set to 'SYNC' on every update
     *
     * @param triggeredBy  employeeId of the admin who triggered the sync
     */
    public SyncResultDto sync(String triggeredBy) {
        log.info("=== Sync started — triggered by: {} ===", triggeredBy);

        SyncResultDto.SyncResultDtoBuilder result = SyncResultDto.builder()
                .triggeredBy(triggeredBy)
                .syncedAt(LocalDateTime.now().format(FORMATTER));

        // ── 1. Sync locations ─────────────────────────────────────────────────
        List<ExternalLocationDto> locations = externalApiClient.fetchLocations();
        result.locationsFetched(locations.size());

        int locInserted = 0, locUpdated = 0;
        for (ExternalLocationDto loc : locations) {
            if (loc.getLocationId() == null || loc.getLocationId().isBlank()) {
                log.warn("Skipping location record with null/blank locationId");
                continue;
            }
            boolean exists = syncRepository.locationExists(loc.getLocationId());
            syncRepository.upsertLocation(loc);
            if (exists) {
                locUpdated++;
                log.debug("[locationmaster] Updated: {}", loc.getLocationId());
            } else {
                locInserted++;
                log.info("[locationmaster] Inserted: {} — status set to NOTCONFIGURED", loc.getLocationId());
                // Generate default card pool for the new location
                cardService.ensureCardsForLocation(
                    loc.getLocationId(), loc.getDescriptiveName());
            }
        }
        result.locationsInserted(locInserted).locationsUpdated(locUpdated);

        // ── 2. Sync employees ─────────────────────────────────────────────────
        List<ExternalEmployeeDto> employees = externalApiClient.fetchEmployees();
        result.employeesFetched(employees.size());

        int empInserted = 0, empUpdated = 0;
        for (ExternalEmployeeDto emp : employees) {
            if (emp.getEmployeeId() == null || emp.getEmployeeId().isBlank()) {
                log.warn("Skipping employee record with null/blank employeeId");
                continue;
            }
            boolean exists = syncRepository.userMasterExists(emp.getEmployeeId());
            syncRepository.upsertUserMaster(emp);
            if (exists) {
                empUpdated++;
                log.debug("[usermaster] Updated: {}", emp.getEmployeeId());
            } else {
                empInserted++;
                log.info("[usermaster] Inserted: {} ({})", emp.getEmployeeId(), emp.getFullName());
            }
        }
        result.employeesInserted(empInserted).employeesUpdated(empUpdated);

        SyncResultDto dto = result.build();
        log.info("=== Sync complete — locations: {} inserted, {} updated | employees: {} inserted, {} updated ===",
                dto.getLocationsInserted(), dto.getLocationsUpdated(),
                dto.getEmployeesInserted(), dto.getEmployeesUpdated());

        return dto;
    }
}
