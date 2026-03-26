package com.medplus.frontdesk.backend.configuration;

import javax.sql.DataSource;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class ApplicationBeansConfig {

	@Autowired
	@Qualifier("medplusDataSource")
	private DataSource medplusDataSource;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public NamedParameterJdbcTemplate medplusNamedParameterJdbcTemplate() {
        return new NamedParameterJdbcTemplate(medplusDataSource);
    }
}