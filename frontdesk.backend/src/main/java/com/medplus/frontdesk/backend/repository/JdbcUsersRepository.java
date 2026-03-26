package com.medplus.frontdesk.backend.repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.*;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import com.medplus.frontdesk.backend.domain.User;

@Repository
public class JdbcUsersRepository implements UsersRepository {

    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;

    private final RowMapper<User> userRowMapper = this::mapUser;

    public JdbcUsersRepository(
            @Qualifier("medplusNamedParameterJdbcTemplate") NamedParameterJdbcTemplate namedParameterJdbcTemplate) {
        this.namedParameterJdbcTemplate = namedParameterJdbcTemplate;
    }

    @Override
    public Optional<User> findByUsername(String username) {

        String sql = "SELECT username, password, Location, role FROM `User` WHERE username = :username";
        Map<String, Object> params = new HashMap<>();
        params.put("username", username);

        try {
            User user = namedParameterJdbcTemplate.queryForObject(sql, params, userRowMapper);
            return Optional.ofNullable(user);

        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    private User mapUser(ResultSet rs, int rowNum) throws SQLException {
        return new User(
                rs.getString("username"),
                rs.getString("password"),
                rs.getString("Location"),
                rs.getString("role")
        );
    }
}