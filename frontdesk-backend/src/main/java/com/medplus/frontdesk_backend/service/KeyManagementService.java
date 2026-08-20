package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.dto.CreateKeyManagementContactDto;
import com.medplus.frontdesk_backend.dto.KeyManagementContactDto;
import com.medplus.frontdesk_backend.dto.KeyManagementListFilterDto;
import com.medplus.frontdesk_backend.dto.PagedResponseDto;
import com.medplus.frontdesk_backend.dto.UserLookupDto;
import com.medplus.frontdesk_backend.repository.KeyManagementRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class KeyManagementService {

    private final KeyManagementRepository repository;
    private final HrmsService hrmsService;

    public PagedResponseDto<KeyManagementContactDto> list(KeyManagementListFilterDto filters, int page, int size) {
        int safeSize = Math.max(1, Math.min(size, 100));
        int safePage = Math.max(0, page);
        long total = repository.countContacts(filters);
        var items = repository.findContacts(filters, safePage * safeSize, safeSize).stream()
                .map(this::forAdminUi)
                .toList();
        return PagedResponseDto.of(items, safePage, safeSize, total);
    }

    public KeyManagementContactDto getById(long id) {
        return forAdminUi(requireContact(id));
    }

    @Transactional
    public KeyManagementContactDto create(CreateKeyManagementContactDto req, String actor) {
        String mobile = req.getMobile().trim();
        if (repository.existsByMobile(mobile, null)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This mobile number is already registered for Key Management.");
        }

        String displayName = resolveDisplayNameFromHrms(mobile, req.getDisplayName());

        long id = repository.insert(mobile, displayName, UUID.randomUUID().toString(), actor);
        return getById(id);
    }

    @Transactional
    public KeyManagementContactDto update(long id, CreateKeyManagementContactDto req, String actor) {
        requireContact(id);

        String mobile = req.getMobile().trim();
        if (repository.existsByMobile(mobile, id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This mobile number is already registered for Key Management.");
        }

        String displayName = resolveDisplayNameFromHrms(mobile, req.getDisplayName());

        int rows = repository.update(id, mobile, displayName, actor);
        if (rows == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Key Management contact not found.");
        }
        return getById(id);
    }

    /**
     * Burns the previous portal token and issues a new one.
     * Old SMS / bookmarked approval links stop working immediately.
     * Token / URL are never returned to the admin UI.
     */
    @Transactional
    public KeyManagementContactDto regeneratePortalToken(long id, String actor) {
        requireContact(id);
        String newToken = UUID.randomUUID().toString();
        int rows = repository.regeneratePortalToken(id, newToken, actor);
        if (rows == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Key Management contact not found.");
        }
        return getById(id);
    }

    @Transactional
    public void delete(long id) {
        int rows = repository.delete(id);
        if (rows == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Key Management contact not found.");
        }
    }

    private KeyManagementContactDto requireContact(long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Key Management contact not found."));
    }

    /** Strip secret portal fields before returning to Electron admin UI. */
    private KeyManagementContactDto forAdminUi(KeyManagementContactDto contact) {
        if (contact != null) {
            contact.setPortalToken(null);
            contact.setPortalUrl(null);
        }
        return contact;
    }

    /** Prefer HRMS name for the mobile; fall back to submitted name only if HRMS has no name. */
    private String resolveDisplayNameFromHrms(String mobile, String requested) {
        UserLookupDto hrms = hrmsService.lookupByPhoneNo(mobile)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "No employee found in HRMS for this mobile number."));
        if (StringUtils.hasText(hrms.getName())) {
            return hrms.getName().trim();
        }
        if (StringUtils.hasText(requested)) {
            return requested.trim();
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "HRMS returned no name for this mobile number.");
    }
}
