package com.medplus.frontdesk.backend.configuration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import lombok.Data;

import javax.sql.DataSource;

@Configuration
@Data
@ConfigurationProperties(prefix = "spring.datasource")
public class DataSourceConfiguration {

    private String driverClassName;
    private String url;
    private String username;
    private String password;

    @Bean
    public DataSource medplusDataSource() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName(driverClassName);
        dataSource.setUrl(url);
        dataSource.setUsername(username);
        dataSource.setPassword(password);
        return dataSource;
    }
}