package com.medplus.frontdesk_backend.exception;

public class ZimbraException extends RuntimeException {

    public ZimbraException(String message) {
        super(message);
    }

    public ZimbraException(String message, Throwable cause) {
        super(message, cause);
    }
}
