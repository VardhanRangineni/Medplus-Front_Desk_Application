package com.medplus.frontdesk.backend.exceptions;

public class VisitorNotFoundException extends RuntimeException {
    public VisitorNotFoundException(String visitorId) {
        super("Visitor not found with ID: " + visitorId);
    }
}
