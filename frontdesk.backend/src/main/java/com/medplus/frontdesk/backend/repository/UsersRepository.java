package com.medplus.frontdesk.backend.repository;

import java.util.Optional;

import com.medplus.frontdesk.backend.domain.User;

public interface UsersRepository {
	Optional<User> findByUsername(String username);
}

