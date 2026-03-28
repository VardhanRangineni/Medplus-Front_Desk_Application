package com.medplus.frontdesk.backend.exceptions;

public class InvalidCredentialsException extends RuntimeException {
	public InvalidCredentialsException() {
		super("Invalid username or password");
	}
}

