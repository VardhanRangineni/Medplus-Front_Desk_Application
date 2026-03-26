package com.medplus.frontdesk.backend.exceptions;

public class UserNotFoundException extends RuntimeException {
	public UserNotFoundException(String username) {
		super("User not found: " + username);
	}
}

