package com.medplus.frontdesk.backend.security;

import com.medplus.frontdesk.backend.domain.User;
import com.medplus.frontdesk.backend.dto.AuthRequest;
import com.medplus.frontdesk.backend.dto.AuthResponse;
import com.medplus.frontdesk.backend.repository.UsersRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final AuthUtil authUtil;
    private final UsersRepository usersRepository;

    public AuthResponse login(AuthRequest authRequest) {

        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        authRequest.getUsername(),
                        authRequest.getPassword()
                )
        );

        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        User user = usersRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new UsernameNotFoundException("Invalid username or password"));

        String token = authUtil.generateAccessToken(user);

        return new AuthResponse(token, authRequest.getUsername());
    }
}
