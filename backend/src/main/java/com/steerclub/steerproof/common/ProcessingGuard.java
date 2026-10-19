package com.steerclub.steerproof.common;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Reject unavailable processing before a controller creates files, jobs or state changes. */
@Configuration
public class ProcessingGuard implements WebMvcConfigurer, HandlerInterceptor {
    private final ProcessingAvailability availability;
    public ProcessingGuard(ProcessingAvailability availability) { this.availability = availability; }
    @Override public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(this).addPathPatterns("/api/**");
    }
    @Override public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        String path = request.getServletPath();
        if (path.isEmpty()) path = request.getRequestURI().substring(request.getContextPath().length());
        if (request.getMethod().equals("POST") && (path.equals("/api/papers")
                || path.equals("/api/papers/batch")
                || path.matches("/api/papers/[^/]+/(retry|generate)")
                || path.matches("/api/assets/[^/]+/regenerate"))) availability.requireProcessing();
        return true;
    }
}
