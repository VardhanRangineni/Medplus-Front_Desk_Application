package com.medplus.frontdesk_backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.retry.annotation.EnableRetry;

@SpringBootApplication
@EnableAsync
@EnableScheduling
@EnableRetry
public class FrontdeskBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(FrontdeskBackendApplication.class, args);
	}

}