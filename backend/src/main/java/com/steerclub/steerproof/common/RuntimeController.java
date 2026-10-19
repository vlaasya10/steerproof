package com.steerclub.steerproof.common;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import java.util.Map;

@RestController
public class RuntimeController {
    private final ProcessingAvailability availability;
    private final boolean ephemeral;
    private final WorkspaceAuth auth;
    public RuntimeController(ProcessingAvailability availability, @Value("${app.storage.ephemeral:false}") boolean ephemeral, WorkspaceAuth auth) {
        this.availability = availability;
        this.ephemeral = ephemeral;
        this.auth = auth;
    }
    /** Public configuration only: never exposes records, credentials or worker state. */
    @GetMapping("/api/public/capabilities")
    public ResponseEntity<?> publicCapabilities() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(Map.of(
                "mode", availability.mode(), "processingEnabled", availability.enabled(),
                "authenticationRequired", auth.enabled()));
    }
    /** Liveness only: no database queries, worker requests, models or bundling. */
    @GetMapping("/health")
    public Map<String, String> health() { return Map.of("status", "ok", "service", "api"); }

    @GetMapping("/api/capabilities")
    public ResponseEntity<?> capabilities() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(Map.of(
                "mode", availability.mode(), "processingEnabled", availability.enabled(),
                "storageEphemeral", ephemeral,
                "message", availability.enabled() ? "Full pipeline configured. Worker errors are reported by each stage."
                        : ProcessingAvailability.MESSAGE));
    }
}
