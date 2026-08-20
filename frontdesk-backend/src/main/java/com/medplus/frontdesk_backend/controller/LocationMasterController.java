package com.medplus.frontdesk_backend.controller;

import com.medplus.frontdesk_backend.dto.ApiResponse;
import com.medplus.frontdesk_backend.dto.CityMasterDto;
import com.medplus.frontdesk_backend.dto.CompanyMasterDto;
import com.medplus.frontdesk_backend.dto.CreateDeviceRequestDto;
import com.medplus.frontdesk_backend.dto.DeviceListFilterDto;
import com.medplus.frontdesk_backend.dto.DeviceMasterDto;
import com.medplus.frontdesk_backend.dto.CreateCityRequestDto;
import com.medplus.frontdesk_backend.dto.CreateCompanyRequestDto;
import com.medplus.frontdesk_backend.dto.CreateLocationRequestDto;
import com.medplus.frontdesk_backend.dto.CreateLocationTypeRequestDto;
import com.medplus.frontdesk_backend.dto.CreateStateRequestDto;
import com.medplus.frontdesk_backend.dto.LocationListFilterDto;
import com.medplus.frontdesk_backend.dto.LocationMasterDto;
import com.medplus.frontdesk_backend.dto.LocationTypeMasterDto;
import com.medplus.frontdesk_backend.dto.MasterStatusRequestDto;
import com.medplus.frontdesk_backend.dto.PagedResponseDto;
import com.medplus.frontdesk_backend.dto.StateMasterDto;
import com.medplus.frontdesk_backend.dto.UpdateDeviceRequestDto;
import com.medplus.frontdesk_backend.model.UserManagement;
import com.medplus.frontdesk_backend.repository.UserRepository;
import com.medplus.frontdesk_backend.service.DeviceMasterService;
import com.medplus.frontdesk_backend.service.LocationMasterService;
import com.medplus.frontdesk_backend.util.WorkstationMacUtil;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/location-master")
@RequiredArgsConstructor
public class LocationMasterController {

    private final LocationMasterService locationMasterService;
    private final DeviceMasterService deviceMasterService;
    private final UserRepository userRepository;

    // ── companies ─────────────────────────────────────────────────────────────

    @GetMapping("/companies")
    @PreAuthorize("hasRole('PRIMARY_ADMIN')")
    public ResponseEntity<ApiResponse<List<CompanyMasterDto>>> listCompanies(
            @RequestParam(defaultValue = "false") boolean activeOnly) {
        return ResponseEntity.ok(ApiResponse.success("Companies retrieved.",
                locationMasterService.listCompanies(activeOnly)));
    }

    @PostMapping("/companies")
    @PreAuthorize("hasRole('PRIMARY_ADMIN')")
    public ResponseEntity<ApiResponse<CompanyMasterDto>> createCompany(
            @Valid @RequestBody CreateCompanyRequestDto body,
            Authentication auth) {
        CompanyMasterDto created = locationMasterService.createCompany(body, auth.getName());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Company created.", created));
    }

    @PatchMapping("/companies/{id}/status")
    @PreAuthorize("hasRole('PRIMARY_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> updateCompanyStatus(
            @PathVariable long id,
            @Valid @RequestBody MasterStatusRequestDto body,
            Authentication auth) {
        locationMasterService.updateCompanyStatus(id, body.getActive(), auth.getName());
        return ResponseEntity.ok(ApiResponse.success("Company status updated.", null));
    }

    // ── location types ────────────────────────────────────────────────────────

    @GetMapping("/location-types")
    @PreAuthorize("hasRole('PRIMARY_ADMIN')")
    public ResponseEntity<ApiResponse<List<LocationTypeMasterDto>>> listLocationTypes(
            @RequestParam(defaultValue = "false") boolean activeOnly) {
        return ResponseEntity.ok(ApiResponse.success("Location types retrieved.",
                locationMasterService.listLocationTypes(activeOnly)));
    }

    @PostMapping("/location-types")
    @PreAuthorize("hasRole('PRIMARY_ADMIN')")
    public ResponseEntity<ApiResponse<LocationTypeMasterDto>> createLocationType(
            @Valid @RequestBody CreateLocationTypeRequestDto body,
            Authentication auth) {
        LocationTypeMasterDto created = locationMasterService.createLocationType(body, auth.getName());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Location type created.", created));
    }

    @PatchMapping("/location-types/{id}/status")
    @PreAuthorize("hasRole('PRIMARY_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> updateLocationTypeStatus(
            @PathVariable long id,
            @Valid @RequestBody MasterStatusRequestDto body,
            Authentication auth) {
        locationMasterService.updateLocationTypeStatus(id, body.getActive(), auth.getName());
        return ResponseEntity.ok(ApiResponse.success("Location type status updated.", null));
    }

    // ── states & cities ───────────────────────────────────────────────────────

    @GetMapping("/states")
    @PreAuthorize("hasRole('PRIMARY_ADMIN')")
    public ResponseEntity<ApiResponse<List<StateMasterDto>>> listStates(
            @RequestParam(defaultValue = "true") boolean activeOnly) {
        return ResponseEntity.ok(ApiResponse.success("States retrieved.",
                locationMasterService.listStates(activeOnly)));
    }

    @PostMapping("/states")
    @PreAuthorize("hasRole('PRIMARY_ADMIN')")
    public ResponseEntity<ApiResponse<StateMasterDto>> createState(
            @Valid @RequestBody CreateStateRequestDto body,
            Authentication auth) {
        StateMasterDto created = locationMasterService.createState(body, auth.getName());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("State created.", created));
    }

    @GetMapping("/cities")
    @PreAuthorize("hasRole('PRIMARY_ADMIN')")
    public ResponseEntity<ApiResponse<List<CityMasterDto>>> listCities(
            @RequestParam(required = false) String stateCode,
            @RequestParam(defaultValue = "true") boolean activeOnly) {
        return ResponseEntity.ok(ApiResponse.success("Cities retrieved.",
                locationMasterService.listCities(stateCode, activeOnly)));
    }

    @PostMapping("/cities")
    @PreAuthorize("hasRole('PRIMARY_ADMIN')")
    public ResponseEntity<ApiResponse<CityMasterDto>> createCity(
            @Valid @RequestBody CreateCityRequestDto body,
            Authentication auth) {
        CityMasterDto created = locationMasterService.createCity(body, auth.getName());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("City created.", created));
    }

    // ── locations ─────────────────────────────────────────────────────────────

    @GetMapping("/locations")
    @PreAuthorize("hasRole('PRIMARY_ADMIN')")
    public ResponseEntity<ApiResponse<PagedResponseDto<LocationMasterDto>>> listLocations(
            @RequestParam(required = false) String locationId,
            @RequestParam(required = false) String locationName,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        var filters = LocationListFilterDto.builder()
                .locationId(locationId)
                .locationName(locationName)
                .status(status)
                .build();
        return ResponseEntity.ok(ApiResponse.success("Locations retrieved.",
                locationMasterService.listLocations(filters, page, size)));
    }

    @PostMapping("/locations")
    @PreAuthorize("hasRole('PRIMARY_ADMIN')")
    public ResponseEntity<ApiResponse<LocationMasterDto>> createLocation(
            @Valid @RequestBody CreateLocationRequestDto body,
            Authentication auth) {
        LocationMasterDto created = locationMasterService.createLocation(body, auth.getName());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Location created.", created));
    }

    @PatchMapping("/locations/{locationId}/status")
    @PreAuthorize("hasRole('PRIMARY_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> updateLocationStatus(
            @PathVariable String locationId,
            @Valid @RequestBody MasterStatusRequestDto body,
            Authentication auth) {
        locationMasterService.updateLocationStatus(locationId, body.getActive(), auth.getName());
        return ResponseEntity.ok(ApiResponse.success("Location status updated.", null));
    }

    @GetMapping("/locations/preview-id")
    @PreAuthorize("hasRole('PRIMARY_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, String>>> previewLocationId(
            @RequestParam long companyId,
            @RequestParam long locationTypeId) {
        String id = locationMasterService.previewNextLocationId(companyId, locationTypeId);
        return ResponseEntity.ok(ApiResponse.success("Preview generated.", Map.of("locationId", id)));
    }

    // ── devices (kiosks / scan points) ────────────────────────────────────────

    @GetMapping("/devices")
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN', 'REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<PagedResponseDto<DeviceMasterDto>>> listDevices(
            @RequestParam(required = false) String locationId,
            @RequestParam(required = false) String displayName,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication auth) {

        var filterBuilder = DeviceListFilterDto.builder()
                .displayName(displayName)
                .status(status);

        // Supervisors only see devices at their assigned location(s).
        if (!hasAuthority(auth, "ROLE_PRIMARY_ADMIN") && hasAuthority(auth, "ROLE_REGIONAL_ADMIN")) {
            List<String> allowed = userRepository.findLocationIdsByEmployeeId(auth.getName());
            if (allowed.isEmpty()) {
                allowed = List.of(requireSupervisorLocation(auth));
            }
            if (locationId != null && !locationId.isBlank()) {
                String requested = locationId.trim();
                boolean ok = allowed.stream().anyMatch(id -> id.equalsIgnoreCase(requested));
                if (!ok) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                            "You can only view devices at your assigned locations.");
                }
                filterBuilder.locationId(requested);
            } else if (allowed.size() == 1) {
                filterBuilder.locationId(allowed.get(0));
            } else {
                filterBuilder.locationIds(allowed);
            }
        } else {
            filterBuilder.locationId(locationId);
        }

        return ResponseEntity.ok(ApiResponse.success("Devices retrieved.",
                deviceMasterService.listDevices(filterBuilder.build(), page, size)));
    }

    @PostMapping("/devices")
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN', 'REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<DeviceMasterDto>> createDevice(
            @Valid @RequestBody CreateDeviceRequestDto body,
            Authentication auth) {
        assertDeviceLocationAccess(auth, body.getLocationId());
        DeviceMasterDto created = deviceMasterService.create(body, auth.getName());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Device created.", created));
    }

    @PutMapping("/devices/{deviceId}")
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN', 'REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<DeviceMasterDto>> updateDevice(
            @PathVariable String deviceId,
            @Valid @RequestBody UpdateDeviceRequestDto body,
            Authentication auth) {
        DeviceMasterDto existing = deviceMasterService.getById(deviceId);
        assertDeviceLocationAccess(auth, existing.getLocationId());
        // Location move: caller must also be allowed at the destination site.
        if (body.getLocationId() != null && !body.getLocationId().isBlank()
                && !body.getLocationId().trim().equalsIgnoreCase(existing.getLocationId())) {
            assertDeviceLocationAccess(auth, body.getLocationId().trim());
        }
        DeviceMasterDto updated = deviceMasterService.update(deviceId, body, auth.getName());
        return ResponseEntity.ok(ApiResponse.success("Device updated.", updated));
    }

    @PatchMapping("/devices/{deviceId}/status")
    @PreAuthorize("hasAnyRole('PRIMARY_ADMIN', 'REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> updateDeviceStatus(
            @PathVariable String deviceId,
            @Valid @RequestBody MasterStatusRequestDto body,
            Authentication auth) {
        DeviceMasterDto existing = deviceMasterService.getById(deviceId);
        assertDeviceLocationAccess(auth, existing.getLocationId());
        deviceMasterService.updateStatus(deviceId, body.getActive(), auth.getName());
        return ResponseEntity.ok(ApiResponse.success("Device status updated.", null));
    }

    @GetMapping("/devices/resolve")
    public ResponseEntity<ApiResponse<DeviceMasterDto>> resolveCurrentDevice(
            @RequestHeader(value = WorkstationMacUtil.HEADER_NAME, required = false) String workstationMac) {
        return deviceMasterService.resolveByMac(workstationMac)
                .map(d -> ResponseEntity.ok(ApiResponse.success("Device resolved.", d)))
                .orElse(ResponseEntity.ok(ApiResponse.success("No registered device for this workstation.", null)));
    }

    /** Primary admins may manage any location; supervisors only their assigned sites. */
    private void assertDeviceLocationAccess(Authentication auth, String locationId) {
        if (hasAuthority(auth, "ROLE_PRIMARY_ADMIN")) {
            return;
        }
        if (!hasAuthority(auth, "ROLE_REGIONAL_ADMIN")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied.");
        }
        String target = locationId != null ? locationId.trim() : "";
        if (target.isEmpty() || !userRepository.hasLocationAccess(auth.getName(), target)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "You can only manage devices at your assigned locations.");
        }
    }

    private String requireSupervisorLocation(Authentication auth) {
        List<String> locations = userRepository.findLocationIdsByEmployeeId(auth.getName());
        if (!locations.isEmpty()) {
            return locations.get(0);
        }
        String location = userRepository.findByEmployeeId(auth.getName())
                .map(UserManagement::getLocation)
                .orElse("");
        if (location == null || location.isBlank()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "No location is assigned to your supervisor account.");
        }
        return location.trim();
    }

    private static boolean hasAuthority(Authentication auth, String authority) {
        return auth != null && auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(authority::equals);
    }
}
