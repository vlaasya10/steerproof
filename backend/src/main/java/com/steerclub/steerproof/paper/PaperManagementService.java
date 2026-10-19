package com.steerclub.steerproof.paper;

import com.steerclub.steerproof.asset.AssetRepository;
import com.steerclub.steerproof.audit.AuditService;
import com.steerclub.steerproof.common.ApiException;
import com.steerclub.steerproof.common.PaperStatus;
import com.steerclub.steerproof.storage.StorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.*;

@Service
public class PaperManagementService {
    private static final Logger log = LoggerFactory.getLogger(PaperManagementService.class);
    private static final Set<PaperStatus> PROCESSING = EnumSet.of(PaperStatus.PARSING, PaperStatus.EXTRACTING,
            PaperStatus.VERIFYING, PaperStatus.WRITING, PaperStatus.RENDERING);
    private final PaperRepository papers;
    private final AssetRepository assets;
    private final StorageService storage;
    private final AuditService audit;

    public PaperManagementService(PaperRepository papers, AssetRepository assets, StorageService storage, AuditService audit) {
        this.papers = papers;
        this.assets = assets;
        this.storage = storage;
        this.audit = audit;
    }

    private String actor(String actor) {
        if (actor == null || actor.isBlank()) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Reviewer name is required");
        return actor.trim();
    }

    @Transactional
    public PaperEntity rename(String id, String name, String reviewer) {
        String actor = actor(reviewer);
        if (name == null || name.isBlank() || name.trim().length() > 200) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Paper name must contain 1–200 characters");
        }
        PaperEntity paper = papers.findForUpdate(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Paper not found"));
        Map<String, Object> before = new LinkedHashMap<>();
        before.put("displayName", paper.getDisplayName());
        paper.setDisplayName(name.trim());
        papers.save(paper);
        audit.log(actor, "PAPER_RENAMED", "paper", id, before, Map.of("displayName", paper.getDisplayName()));
        return paper;
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(String id, String reviewer) throws IOException {
        String actor = actor(reviewer);
        PaperEntity paper = papers.findForUpdate(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Paper not found"));
        if (PROCESSING.contains(paper.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "PAPER_PROCESSING", "Wait for this paper to finish processing before deleting it");
        }
        if (!id.matches("[A-Za-z0-9_-]+")) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Invalid paper ID");
        Set<Path> targets = new LinkedHashSet<>();
        if (paper.getPdfPath() != null && papers.countByPdfPath(paper.getPdfPath()) == 1) {
            Path pdf = storage.resolve(paper.getPdfPath());
            if (!storage.resolve("papers").equals(pdf.getParent()) || !pdf.getFileName().toString().toLowerCase(Locale.ROOT).endsWith(".pdf")) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PATH", "PDF must be inside paper storage");
            }
            targets.add(pdf);
        }
        for (String relative : List.of("pages/" + id, "renders/" + id, "parsed/" + id + ".json", "exports/" + id + ".zip")) {
            targets.add(storage.resolve(relative));
        }
        var ownedAssets = assets.findByPaperIdOrderByIdAsc(id);
        for (var asset : ownedAssets) {
            if (!asset.getId().matches("[A-Za-z0-9_-]+")) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PATH", "Invalid asset storage ID");
            targets.add(storage.resolve("audio/" + asset.getId()));
        }
        // Stage owned files so transaction rollback can restore them. Shared media/cache stays intact.
        Path staging = storage.resolve(".trash/" + UUID.randomUUID());
        Map<Path, Path> moved = new LinkedHashMap<>();
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCompletion(int status) {
                try {
                    if (status != STATUS_COMMITTED) {
                        for (var entry : moved.entrySet()) {
                            Files.createDirectories(entry.getKey().getParent());
                            Files.move(entry.getValue(), entry.getKey());
                        }
                    }
                    purge(staging);
                } catch (IOException error) {
                    log.error("Paper file cleanup/restore failed for {} at {}", id, staging, error);
                }
            }
        });
        for (Path target : targets) {
            if (Files.exists(target, LinkOption.NOFOLLOW_LINKS)) {
                Path realRoot = storage.getRootPath().toRealPath();
                if (!target.getParent().toRealPath().startsWith(realRoot)) throw new IOException("Storage target is outside storage directory");
                Path destination = staging.resolve(Integer.toString(moved.size()));
                Files.createDirectories(staging);
                if (!staging.toRealPath().startsWith(realRoot)) throw new IOException("Staging path is outside storage directory");
                Files.move(target, destination);
                moved.put(target, destination);
            }
        }
        Map<String, Object> before = new LinkedHashMap<>();
        before.put("title", paper.getTitle());
        before.put("displayName", paper.getDisplayName());
        before.put("status", paper.getStatus().name());
        audit.log(actor, "PAPER_DELETED", "paper", id, before, Map.of("deleted", true));
        // Remove asset-to-claim references before the paper cascade removes claims.
        assets.deleteAll(ownedAssets);
        assets.flush();
        papers.delete(paper);
        papers.flush();
    }

    private void purge(Path path) throws IOException {
        Path root = storage.getRootPath();
        if (!path.normalize().startsWith(root.resolve(".trash")) || path.equals(root)) throw new IOException("Invalid cleanup path");
        if (!Files.exists(path, LinkOption.NOFOLLOW_LINKS)) return;
        Files.walkFileTree(path, new SimpleFileVisitor<>() {
            @Override public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                Files.delete(file);
                return FileVisitResult.CONTINUE;
            }
            @Override public FileVisitResult postVisitDirectory(Path dir, IOException error) throws IOException {
                if (error != null) throw error;
                Files.delete(dir);
                return FileVisitResult.CONTINUE;
            }
        });
    }
}
