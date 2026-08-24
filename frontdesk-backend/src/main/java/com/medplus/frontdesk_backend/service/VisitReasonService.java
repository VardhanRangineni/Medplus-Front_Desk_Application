package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.dto.CreateVisitReasonRequestDto;
import com.medplus.frontdesk_backend.dto.PagedResponseDto;
import com.medplus.frontdesk_backend.dto.VisitReasonDto;
import com.medplus.frontdesk_backend.model.VisitReasonType;
import com.medplus.frontdesk_backend.repository.VisitReasonRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
public class VisitReasonService {

    private final VisitReasonRepository repository;

    // ── Paginated list (admin UI) ────────────────────────────────────────────

    public PagedResponseDto<VisitReasonDto> list(VisitReasonType type, String status, int page, int size) {
        int safeSize = Math.max(1, Math.min(size, 100));
        int safePage = Math.max(0, page);
        long total = repository.countAll(type, status);
        List<VisitReasonDto> items = repository.findAll(type, status, safePage * safeSize, safeSize);
        return PagedResponseDto.of(items, safePage, safeSize, total);
    }

    // ── Active reasons (dropdown consumers) ──────────────────────────────────

    public List<VisitReasonDto> getActiveByType(VisitReasonType type) {
        return repository.findActiveByType(type);
    }

    // ── Create ────────────────────────────────────────────────────────────────

    /** Maximum visit reasons allowed per type */
    private static final int MAX_REASONS_PER_TYPE = 10;

    @Transactional
    public VisitReasonDto create(CreateVisitReasonRequestDto req, String actor) {
        long count = repository.countAll(req.getType(), null);
        if (count >= MAX_REASONS_PER_TYPE) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "Maximum " + MAX_REASONS_PER_TYPE + " reasons allowed per type.");
        }
        long id = repository.insert(req.getType(), req.getReasonName(), actor);
        return getById(id);
    }

    // ── Update name ───────────────────────────────────────────────────────────

    @Transactional
    public VisitReasonDto updateName(long id, String reasonName, String actor) {
        requireReason(id);
        int rows = repository.updateName(id, reasonName, actor);
        if (rows == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Visit reason not found.");
        }
        return getById(id);
    }

    // ── Toggle status ────────────────────────────────────────────────────────

    @Transactional
    public VisitReasonDto toggleStatus(long id, boolean active, String actor) {
        requireReason(id);
        int rows = repository.updateStatus(id, active, actor);
        if (rows == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Visit reason not found.");
        }
        return getById(id);
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    @Transactional
    public void delete(long id) {
        int rows = repository.delete(id);
        if (rows == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Visit reason not found.");
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private VisitReasonDto getById(long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.INTERNAL_SERVER_ERROR, "Failed to load visit reason."));
    }

    private VisitReasonDto requireReason(long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Visit reason not found."));
    }
}
