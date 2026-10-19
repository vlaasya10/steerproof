package com.steerclub.steerproof.common;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class WorkspaceAuthController {
    private final WorkspaceAuth auth;
    public WorkspaceAuthController(WorkspaceAuth auth) { this.auth = auth; }
    public record LoginRequest(String password) {}

    @GetMapping("/config")
    public ResponseEntity<?> config() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(Map.of("enabled", auth.enabled()));
    }

    @PostMapping("/login")
    public ResponseEntity<WorkspaceAuth.Session> login(@RequestBody LoginRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(auth.login(request.password()));
    }
}
