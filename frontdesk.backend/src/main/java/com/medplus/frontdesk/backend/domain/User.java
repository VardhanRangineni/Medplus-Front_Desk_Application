package com.medplus.frontdesk.backend.domain;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class User {
	private String username;
	private String password;
	private String Location;
	private String role;
}

