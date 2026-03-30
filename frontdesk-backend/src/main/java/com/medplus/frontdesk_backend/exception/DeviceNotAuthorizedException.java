package com.medplus.frontdesk_backend.exception;

public class DeviceNotAuthorizedException extends RuntimeException {

    public DeviceNotAuthorizedException(String message) {
        super(message);
    }
}
