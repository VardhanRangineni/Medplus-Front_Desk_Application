package com.medplus.frontdesk_backend.exception;

public class ZimbraSessionNotFoundException extends RuntimeException {

    public ZimbraSessionNotFoundException(String sessionId) {
        super("Zimbra session not found or expired: " + sessionId);
    }
}
