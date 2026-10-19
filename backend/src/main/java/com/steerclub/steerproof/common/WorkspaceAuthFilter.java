package com.steerclub.steerproof.common;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.Map;

public class WorkspaceAuthFilter extends OncePerRequestFilter {
    private final WorkspaceAuth auth;
    private final ObjectMapper mapper;
    public WorkspaceAuthFilter(WorkspaceAuth auth, ObjectMapper mapper) { this.auth = auth; this.mapper = mapper; }

    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = request.getRequestURI();
        if (!auth.enabled() || path.equals("/actuator/health") || path.equals("/api/auth/config")
                || (path.equals("/api/auth/login") && request.getMethod().equals("POST"))) {
            chain.doFilter(request, response);
            return;
        }
        String authorization = request.getHeader("Authorization");
        String token = authorization != null && authorization.startsWith("Bearer ") ? authorization.substring(7) : null;
        boolean allowed = auth.valid(token, "api") || (path.startsWith("/files/") && auth.valid(request.getParameter("access_token"), "media"));
        response.setHeader("Cache-Control", "private, no-store");
        response.setHeader("Referrer-Policy", "no-referrer");
        if (!allowed) {
            response.setStatus(401);
            response.setContentType("application/json");
            mapper.writeValue(response.getOutputStream(), Map.of("error", "UNAUTHORIZED", "message", "Sign in to this workspace"));
            return;
        }
        chain.doFilter(request, response);
    }
}
