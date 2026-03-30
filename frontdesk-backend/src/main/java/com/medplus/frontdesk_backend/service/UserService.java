package com.medplus.frontdesk_backend.service;

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
    private final SyncService syncService;

    /**
     * Returns all users from the local usermaster table.
     */
    public List<UserDto> getAllUsers() {
        return userRepository.findAllUserDtos();
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
