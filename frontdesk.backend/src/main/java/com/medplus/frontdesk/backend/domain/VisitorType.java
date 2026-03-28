package com.medplus.frontdesk.backend.domain;

public enum VisitorType {

    EMPLOYEE("EMPLOYEE"),
    VISITOR("VISITOR");

    private final String value;

    // Constructor
    VisitorType(String value) {
        this.value = value;
    }

    // Getter method
    public String getValue() {
        return value;
    }

    // Override toString()
    @Override
    public String toString() {
        return value;
    }
}
