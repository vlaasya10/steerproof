package com.steerclub.steerproof.common;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.List;
import java.util.Arrays;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import com.fasterxml.jackson.databind.ObjectMapper;

@Configuration
public class WebConfig {
    private final List<String> allowedOrigins;

    public WebConfig() { this("http://localhost:3000,http://127.0.0.1:3000"); }

    @Autowired
    public WebConfig(@Value("${app.cors.allowed-origins:http://localhost:3000,http://127.0.0.1:3000}") String origins) {
        allowedOrigins = Arrays.stream(origins.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
        if (allowedOrigins.isEmpty() || allowedOrigins.stream().anyMatch(s -> s.contains("*"))) {
            throw new IllegalArgumentException("Configure exact CORS origins");
        }
    }

    @Bean
    public FilterRegistrationBean<CorsFilter> corsFilter() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(allowedOrigins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        FilterRegistrationBean<CorsFilter> registration = new FilterRegistrationBean<>(new CorsFilter(source));
        // Include CORS headers on failures raised before MVC resolves a handler, such as oversized uploads.
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return registration;
    }

    @Bean
    public FilterRegistrationBean<WorkspaceAuthFilter> workspaceAuthFilter(WorkspaceAuth auth, ObjectMapper mapper) {
        var registration = new FilterRegistrationBean<>(new WorkspaceAuthFilter(auth, mapper));
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE + 1);
        return registration;
    }
}
