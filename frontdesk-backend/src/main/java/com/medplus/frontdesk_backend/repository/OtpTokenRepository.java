package com.medplus.frontdesk_backend.repository;

import com.medplus.frontdesk_backend.model.OtpToken;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class OtpTokenRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public void save(OtpToken token) {
        String sql = """
                INSERT INTO otp_tokens (mobile_number, token, created_at, expires_at)
                VALUES (:mobileNumber, :token, :createdAt, :expiresAt)
                ON DUPLICATE KEY UPDATE
                    token = VALUES(token),
                    created_at = VALUES(created_at),
                    expires_at = VALUES(expires_at)
                """;
        jdbc.update(sql, new MapSqlParameterSource()
                .addValue("mobileNumber", token.getMobileNumber())
                .addValue("token", token.getToken())
                .addValue("createdAt", java.sql.Timestamp.valueOf(token.getCreatedAt()))
                .addValue("expiresAt", java.sql.Timestamp.valueOf(token.getExpiresAt()))
        );
    }

    public Optional<OtpToken> findByMobileNumber(String mobileNumber) {
        String sql = "SELECT mobile_number, token, created_at, expires_at FROM otp_tokens WHERE mobile_number = :mobileNumber";
        List<OtpToken> list = jdbc.query(sql, new MapSqlParameterSource("mobileNumber", mobileNumber), this::mapRow);
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    public void deleteByMobileNumber(String mobileNumber) {
        String sql = "DELETE FROM otp_tokens WHERE mobile_number = :mobileNumber";
        jdbc.update(sql, new MapSqlParameterSource("mobileNumber", mobileNumber));
    }

    public int deleteExpired(LocalDateTime now) {
        String sql = "DELETE FROM otp_tokens WHERE expires_at <= :now";
        return jdbc.update(sql, new MapSqlParameterSource("now", java.sql.Timestamp.valueOf(now)));
    }

    private OtpToken mapRow(ResultSet rs, int rowNum) throws SQLException {
        return OtpToken.builder()
                .mobileNumber(rs.getString("mobile_number"))
                .token(rs.getString("token"))
                .createdAt(rs.getTimestamp("created_at").toLocalDateTime())
                .expiresAt(rs.getTimestamp("expires_at").toLocalDateTime())
                .build();
    }
}
