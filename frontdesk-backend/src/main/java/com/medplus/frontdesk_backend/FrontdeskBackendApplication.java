package com.medplus.frontdesk_backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class FrontdeskBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(FrontdeskBackendApplication.class, args);
	}

}