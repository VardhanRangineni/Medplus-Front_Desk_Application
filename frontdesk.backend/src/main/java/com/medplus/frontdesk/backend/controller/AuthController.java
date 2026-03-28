package com.medplus.frontdesk.backend.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.medplus.frontdesk.backend.dto.AuthRequest;
import com.medplus.frontdesk.backend.dto.AuthResponse;
import com.medplus.frontdesk.backend.security.AuthService;

import lombok.extern.slf4j.Slf4j;

@RestController
@RequestMapping("/auth")
@Slf4j
public class AuthController {

    @Autowired
    private AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody AuthRequest loginRequestDto) {
        return ResponseEntity.ok(authService.login(loginRequestDto));   
    } 
}
