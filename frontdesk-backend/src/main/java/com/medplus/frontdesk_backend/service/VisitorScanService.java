package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.dto.DeviceMasterDto;
import com.medplus.frontdesk_backend.dto.VisitorMovementEventDto;
import com.medplus.frontdesk_backend.dto.VisitorScanResponseDto;
import com.medplus.frontdesk_backend.model.VisitStatus;
import com.medplus.frontdesk_backend.model.Visitor;
import com.medplus.frontdesk_backend.model.VisitorScanEventType;
import com.medplus.frontdesk_backend.repository.UserRepository;
import com.medplus.frontdesk_backend.repository.VisitorRepository;
import com.medplus.frontdesk_backend.repository.VisitorScanEventRepository;
import com.medplus.frontdesk_backend.security.AuthorizationHelper;
import com.medplus.frontdesk_backend.util.WorkstationMacUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class VisitorScanService {

    private static final Pattern VISITOR_ID_PATTERN =
            Pattern.compile("^MED-(?:GV|V)-\\d{4,12}$", Pattern.CASE_INSENSITIVE);

    private final VisitorRepository visitorRepository;
    private final VisitorScanEventRepository scanEventRepository;
    private final DeviceMasterService deviceMasterService;
    private final OperationalLocationService operationalLocationService;
    private final UserRepository userRepository;
    private final AuthorizationHelper authorizationHelper;

    @Value("${app.visitor-scan.debounce-seconds:60}")
    private int debounceSeconds;

    public List<VisitorMovementEventDto> getMovementTrail(String visitorId) {
        return scanEventRepository.findMovementByVisitorId(visitorId);
    }

    @Transactional
    public VisitorScanResponseDto recordZoneScan(String rawPayload, String scannedBy,
                                                  String workstationMac) {
        authorizationHelper.requireCheckInPermission();

        // Same desk identity as header / check-in (assigned kiosk, not only PC MAC).
        DeviceMasterDto device = resolveScanDevice(scannedBy, workstationMac);
        String visitorId = resolveVisitorId(parsePayload(rawPayload));
        Visitor visitor = visitorRepository.findById(visitorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Visitor entry not found: " + visitorId));

        if (visitor.getStatus() == VisitStatus.CHECKED_OUT) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Visitor is already checked out.");
        }
        if (visitor.getStatus() != VisitStatus.CHECKED_IN
                && visitor.getStatus() != VisitStatus.APPROVED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Visitor is not currently checked in.");
        }

        if (!locationsMatch(visitor.getLocationId(), device.getLocationId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Visitor checked in at a different location. Check out and re-check-in at this site.");
        }

        LocalDateTime now = LocalDateTime.now();
        boolean duplicate = scanEventRepository.findLastZoneScanAt(visitorId, device.getDeviceId())
                .map(last -> ChronoUnit.SECONDS.between(last, now) < debounceSeconds)
                .orElse(false);

        if (!duplicate) {
            scanEventRepository.insert(
                    visitorId,
                    device.getLocationId(),
                    device.getDeviceId(),
                    VisitorScanEventType.ZONE_SCAN,
                    extractPreregToken(rawPayload),
                    scannedBy,
                    WorkstationMacUtil.toStoredValue(workstationMac),
                    now);
            visitorRepository.updateLastScan(visitorId, device.getDeviceId(), now);
            log.info("Zone scan: {} at device {} by {}", visitorId, device.getDeviceId(), scannedBy);
        }

        String locationName = userRepository.findLocationName(device.getLocationId())
                .orElse(device.getLocationId());

        return VisitorScanResponseDto.builder()
                .visitorId(visitorId)
                .visitorName(visitor.getName())
                .status(visitor.getStatus().name())
                .eventType(VisitorScanEventType.ZONE_SCAN.name())
                .deviceId(device.getDeviceId())
                .deviceName(device.getDisplayName())
                .locationId(device.getLocationId())
                .locationName(locationName)
                .scannedAt(now)
                .duplicateSuppressed(duplicate)
                .message(duplicate
                        ? "Scan already recorded recently at this kiosk."
                        : "Movement recorded at " + device.getDisplayName() + ".")
                .build();
    }

    @Transactional
    public void recordCheckInScan(Visitor visitor, DeviceMasterDto device, String scannedBy,
                                    String workstationMac, String preregToken) {
        if (device == null || visitor == null) {
            return;
        }
        LocalDateTime now = LocalDateTime.now();
        scanEventRepository.insert(
                visitor.getVisitorId(),
                device.getLocationId(),
                device.getDeviceId(),
                VisitorScanEventType.CHECK_IN,
                preregToken,
                scannedBy,
                WorkstationMacUtil.toStoredValue(workstationMac),
                now);
        visitorRepository.updateLastScan(visitor.getVisitorId(), device.getDeviceId(), now);
    }

    @Transactional
    public void recordCheckOutScan(Visitor visitor, DeviceMasterDto device, String scannedBy,
                                     String workstationMac) {
        if (device == null || visitor == null) {
            return;
        }
        LocalDateTime now = LocalDateTime.now();
        scanEventRepository.insert(
                visitor.getVisitorId(),
                device.getLocationId(),
                device.getDeviceId(),
                VisitorScanEventType.CHECK_OUT,
                null,
                scannedBy,
                WorkstationMacUtil.toStoredValue(workstationMac),
                now);
        visitorRepository.updateLastScan(visitor.getVisitorId(), device.getDeviceId(), now);
    }

    public Optional<DeviceMasterDto> resolveDeviceOptional(String workstationMac) {
        if (!StringUtils.hasText(workstationMac)) {
            return Optional.empty();
        }
        return deviceMasterService.resolveByMac(workstationMac);
    }

    private DeviceMasterDto resolveScanDevice(String employeeId, String workstationMac) {
        return operationalLocationService.resolveDeskDevice(employeeId, workstationMac)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "No desk kiosk is available for this session. Assign a kiosk or use a registered PC."));
    }

    private String parsePayload(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Scan payload is empty.");
        }
        return raw.trim();
    }

    private String resolveVisitorId(String payload) {
        String normalized = payload.trim();
        if (normalized.regionMatches(true, 0, "PREREG:", 0, 7)) {
            String token = normalized.substring(7).trim();
            return visitorRepository.findVisitorIdByPreregToken(token)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                            "No checked-in visitor found for this registration QR."));
        }
        if (normalized.regionMatches(true, 0, "VISITOR:", 0, 8)) {
            normalized = normalized.substring(8).trim();
        }
        if (!VISITOR_ID_PATTERN.matcher(normalized).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Unrecognized QR code. Expected a visitor pass or registration code.");
        }
        return normalized.toUpperCase();
    }

    private static String extractPreregToken(String payload) {
        if (payload != null && payload.trim().regionMatches(true, 0, "PREREG:", 0, 7)) {
            return payload.trim().substring(7).trim();
        }
        return null;
    }

    private static boolean locationsMatch(String a, String b) {
        if (a == null || b == null) {
            return false;
        }
        return a.trim().equalsIgnoreCase(b.trim());
    }
}
