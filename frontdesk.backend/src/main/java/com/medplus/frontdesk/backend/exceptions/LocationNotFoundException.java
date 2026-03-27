package com.medplus.frontdesk.backend.exceptions;

public class LocationNotFoundException extends RuntimeException {
    public LocationNotFoundException(String locationId) {
        super("Location not found with ID: " + locationId);
    }
}
