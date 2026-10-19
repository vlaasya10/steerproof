package com.steerclub.steerproof.paper;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api/papers")
public class PaperManagementController {
    private final PaperManagementService service;
    public PaperManagementController(PaperManagementService service) { this.service = service; }
    public record RenameRequest(String name, String actor) {}
    public record DeleteRequest(String actor) {}

    @PatchMapping("/{id}")
    public Map<String, String> rename(@PathVariable String id, @RequestBody RenameRequest request) {
        PaperEntity paper = service.rename(id, request.name(), request.actor());
        return Map.of("paperId", paper.getId(), "displayName", paper.getDisplayName());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id, @RequestBody DeleteRequest request) throws IOException {
        service.delete(id, request.actor());
        return ResponseEntity.noContent().build();
    }
}
