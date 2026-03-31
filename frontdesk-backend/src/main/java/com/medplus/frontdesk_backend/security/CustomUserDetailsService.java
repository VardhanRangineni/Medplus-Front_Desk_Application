package com.medplus.frontdesk_backend.security;

import com.medplus.frontdesk_backend.model.UserManagement;
import com.medplus.frontdesk_backend.model.UserStatus;
import com.medplus.frontdesk_backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String employeeId) throws UsernameNotFoundException {
        log.debug("Loading user details for employeeId: {}", employeeId);

        UserManagement userManagement = userRepository.findByEmployeeId(employeeId)
                .orElseThrow(() -> new UsernameNotFoundException(
                        "No user found with employeeId: " + employeeId));

        return User.builder()
                .username(userManagement.getEmployeeid())
                .password(userManagement.getPassword())
                .authorities(List.of(new SimpleGrantedAuthority("ROLE_" + userManagement.getRole())))
                .accountExpired(false)
                .accountLocked(false)
                .credentialsExpired(false)
                .disabled(userManagement.getStatus() == UserStatus.INACTIVE)
                .build();
    }
}
