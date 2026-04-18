package com.medplus.frontdesk_backend.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@RequiredArgsConstructor
public class WebConfig implements WebMvcConfigurer {

    private final ZimbraSessionInterceptor zimbraSessionInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(zimbraSessionInterceptor)
                .addPathPatterns("/zimbra/**")
                // login is public; logout reads the cookie itself and clears it
                .excludePathPatterns("/zimbra/auth/login", "/zimbra/auth/logout");
    }
}
