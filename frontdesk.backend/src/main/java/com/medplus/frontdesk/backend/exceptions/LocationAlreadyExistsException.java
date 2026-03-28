package com.medplus.frontdesk.backend.exceptions;

public class LocationAlreadyExistsException extends RuntimeException {
    public LocationAlreadyExistsException(String locationId) {
        super("Location already exists with ID: " + locationId);
    }
}
