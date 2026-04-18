package com.medplus.frontdesk_backend.dto.zimbra;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ZimbraLoginResponseDto {
    /** User's email — safe to expose for UI display. sessionId goes in HttpOnly cookie. */
    private String email;
}
