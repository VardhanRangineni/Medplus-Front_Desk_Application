package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.dto.CreateDeviceRequestDto;
import com.medplus.frontdesk_backend.dto.DeviceListFilterDto;
import com.medplus.frontdesk_backend.dto.DeviceMasterDto;
import com.medplus.frontdesk_backend.dto.PagedResponseDto;
import com.medplus.frontdesk_backend.dto.UpdateDeviceRequestDto;
import com.medplus.frontdesk_backend.repository.DeviceMasterRepository;
import com.medplus.frontdesk_backend.util.WorkstationMacUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class DeviceMasterService {

    private final DeviceMasterRepository repository;

    public PagedResponseDto<DeviceMasterDto> listDevices(DeviceListFilterDto filters, int page, int size) {
        int safeSize = Math.max(1, Math.min(size, 100));
        int safePage = Math.max(0, page);
        long total = repository.countDevices(filters);
        var items = repository.findDevices(filters, safePage * safeSize, safeSize);
        int totalPages = total == 0 ? 0 : (int) Math.ceil((double) total / safeSize);
        return PagedResponseDto.<DeviceMasterDto>builder()
                .content(items)
                .page(safePage)
                .size(safeSize)
                .totalElements(total)
                .totalPages(totalPages)
                .build();
    }

    public DeviceMasterDto getById(String deviceId) {
        return repository.findById(deviceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Device not found."));
    }

    public Optional<DeviceMasterDto> resolveByMac(String mac) {
        return repository.findActiveByMac(mac);
    }

    public DeviceMasterDto create(CreateDeviceRequestDto req, String actor) {
        String locationId = req.getLocationId().trim();
        if (!repository.locationExists(locationId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Location not found.");
        }

        String displayName = req.getDisplayName().trim();
        String floor = trimOrNull(req.getFloor());
        String area = trimOrNull(req.getArea());
        String mac = normalizeMacOrNull(req.getMacAddress());
        String ip = normalizeIpOrNull(req.getIpAddress());

        assertMacAvailableForRegistration(mac, null);

        int seq = repository.nextSequenceForLocation(locationId);
        if (seq > 999) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Maximum devices reached for this location.");
        }
        String deviceId = locationId + "-D" + String.format("%03d", seq);

        repository.insert(deviceId, locationId, displayName, floor, area, mac, ip, actor);
        return getById(deviceId);
    }

    public DeviceMasterDto update(String deviceId, UpdateDeviceRequestDto req, String actor) {
        DeviceMasterDto existing = getById(deviceId);

        String locationId = existing.getLocationId();
        if (req.getLocationId() != null && StringUtils.hasText(req.getLocationId().trim())) {
            locationId = req.getLocationId().trim();
            if (!repository.locationExists(locationId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Location not found.");
            }
        }

        String displayName = req.getDisplayName() != null
                ? req.getDisplayName().trim() : existing.getDisplayName();
        if (!StringUtils.hasText(displayName)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Display name is required.");
        }

        String floor = req.getFloor() != null ? trimOrNull(req.getFloor()) : existing.getFloor();
        String area = req.getArea() != null ? trimOrNull(req.getArea()) : existing.getArea();
        String mac = req.getMacAddress() != null
                ? normalizeMacOrNull(req.getMacAddress()) : existing.getMacAddress();
        String ip = req.getIpAddress() != null
                ? normalizeIpOrNull(req.getIpAddress()) : existing.getIpAddress();

        assertMacAvailableForRegistration(mac, deviceId);

        repository.update(deviceId, locationId, displayName, floor, area, mac, ip, actor);
        return getById(deviceId);
    }

    public void updateStatus(String deviceId, boolean active, String actor) {
        DeviceMasterDto existing = getById(deviceId);
        if (active) {
            // Block reactivate when another site already went live with same MAC.
            assertMacAvailableForRegistration(existing.getMacAddress(), deviceId);
        }
        repository.updateStatus(deviceId, active, actor);
    }

    public void touchLastKnownIp(String deviceId, String ip) {
        repository.updateLastKnownIp(deviceId, ip);
    }

    /**
     * MAC may be re-registered only when no other ACTIVE device holds it.
     * Inactive device at previous location → allow add at new site.
     */
    private void assertMacAvailableForRegistration(String mac, String excludeDeviceId) {
        if (mac == null) {
            return;
        }
        repository.findActiveByMacExcluding(mac, excludeDeviceId).ifPresent(other -> {
            String locLabel = StringUtils.hasText(other.getLocationName())
                    ? other.getLocationName() + " (" + other.getLocationId() + ")"
                    : other.getLocationId();
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This MAC is already active at " + locLabel
                            + ". Deactivate or move that device first, or contact your admin / that location's supervisor.");
        });
    }

    private static String trimOrNull(String value) {
        if (value == null) return null;
        String t = value.trim();
        return t.isEmpty() ? null : t;
    }

    private static String normalizeIpOrNull(String ip) {
        if (ip == null || ip.isBlank()) {
            return null;
        }
        String trimmed = ip.trim();
        if ("0.0.0.0".equals(trimmed)) {
            return null;
        }
        return trimmed;
    }

    private static String normalizeMacOrNull(String mac) {
        if (mac == null || mac.isBlank()) {
            return null;
        }
        String stored = WorkstationMacUtil.toStoredValue(mac);
        if (stored == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid MAC address.");
        }
        return stored;
    }
}
