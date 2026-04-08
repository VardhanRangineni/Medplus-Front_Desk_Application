package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.dto.PagedResponseDto;
import com.medplus.frontdesk_backend.dto.UserDto;
import com.medplus.frontdesk_backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final SyncService    syncService;

    /**
     * Returns all users from the local usermaster table (used by sync response).
     */
    public List<UserDto> getAllUsers() {
        return userRepository.findAllUserDtos();
    }

    /**
     * Returns a single page of users, optionally filtered by a search term and location.
     *
     * @param search     case-insensitive substring across id / name / dept / location
     * @param locationId restrict to this location; null = all locations
     * @param page       0-based page index
     * @param size       records per page
     */
    public PagedResponseDto<UserDto> getUsersPaged(String search, String locationId, int page, int size) {
        int    offset = page * size;
        String q      = (search != null && !search.isBlank()) ? search : null;
        String loc    = (locationId != null && !locationId.isBlank()) ? locationId : null;
        List<UserDto> rows  = userRepository.findUserDtosPaged(q, loc, offset, size);
        long          total = userRepository.countUserDtos(q, loc);
        return PagedResponseDto.of(rows, page, size, total);
    }

    /**
     * Triggers a full sync from the external HR API, then returns
     * all users from the now-updated local usermaster table.
     */
    public List<UserDto> syncAndGetUsers(String triggeredBy) {
        log.info("User sync requested by: {}", triggeredBy);
        syncService.sync(triggeredBy);
        return userRepository.findAllUserDtos();
    }
}
