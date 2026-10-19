package com.steerclub.steerproof.paper;

import com.steerclub.steerproof.asset.*;
import com.steerclub.steerproof.audit.AuditService;
import com.steerclub.steerproof.claim.*;
import com.steerclub.steerproof.common.*;
import com.steerclub.steerproof.passage.*;
import com.steerclub.steerproof.policy.*;
import com.steerclub.steerproof.storage.StorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.nio.file.*;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class PaperManagementIntegrationTest {
    @Autowired PaperManagementService service;
    @Autowired PaperRepository papers;
    @Autowired AssetRepository assets;
    @Autowired ClaimRepository claims;
    @Autowired PassageRepository passages;
    @Autowired AssetClaimRepository links;
    @Autowired PolicyViolationRepository violations;
    @Autowired AuditService audit;
    @Autowired StorageService storage;
    @Autowired JdbcTemplate jdbc;
    @Autowired IdGenerator ids;
    private PaperEntity paper;
    private Path pdf;

    @BeforeEach
    void fixture() throws Exception {
        String id = "P-MGMT-" + UUID.randomUUID().toString().substring(0, 8);
        paper = new PaperEntity(id, "papers/" + id + ".pdf", PaperStatus.AWAITING_CLAIM_REVIEW);
        paper.setTitle("Original scientific title");
        papers.save(paper);
        pdf = storage.resolve(paper.getPdfPath());
        Files.writeString(pdf, "PDF fixture");
    }

    @Test
    void renamePreservesScientificTitleAndApprovalState() {
        service.rename(paper.getId(), "  Laasya's research  ", "Laasya");
        var saved = papers.findById(paper.getId()).orElseThrow();
        assertEquals("Laasya's research", saved.getDisplayName());
        assertEquals("Original scientific title", saved.getTitle());
        assertEquals(PaperStatus.AWAITING_CLAIM_REVIEW, saved.getStatus());
        assertEquals("PAPER_RENAMED", audit.getAuditHistory(paper.getId()).getFirst().action());
    }

    @Test
    void rejectsBlankNamesAndMissingReviewers() {
        assertThrows(ApiException.class, () -> service.rename(paper.getId(), " ", "Laasya"));
        assertThrows(ApiException.class, () -> service.rename(paper.getId(), "x".repeat(201), "Laasya"));
        assertThrows(ApiException.class, () -> service.rename(paper.getId(), "Research", ""));
        assertNull(papers.findById(paper.getId()).orElseThrow().getDisplayName());
    }

    private ClaimEntity relatedClaim() {
        var passage = new PassageEntity("E-" + paper.getId(), paper.getId(), null, "paragraph", 1, "{}", 600f, 800f, "Fixture passage", 1);
        passages.save(passage);
        var claim = new ClaimEntity();
        claim.setId("C-" + paper.getId());
        claim.setPaperId(paper.getId());
        claim.setPassageId(passage.getId());
        claim.setQuote("Fixture passage");
        claim.setScientificClaim("Fixture claim");
        claim.setFindingClass(FindingClass.PRIMARY);
        claim.setDoctorStatus(DoctorStatus.APPROVED);
        return claims.save(claim);
    }

    @Test
    void deleteRemovesDependentRecordsAndOwnedFilesButRetainsAuditAndSharedFiles() throws Exception {
        var claim = relatedClaim();
        var asset = new AssetEntity();
        asset.setId("A-" + paper.getId());
        asset.setPaperId(paper.getId());
        asset.setType(AssetType.CAPTION);
        asset.setContent("{}");
        assets.save(asset);
        links.save(new AssetClaimEntity(asset.getId(), claim.getId(), "caption:p1"));
        violations.save(new PolicyViolationEntity(asset.getId(), claim.getId(), "caption:p1", "LENGTH", Severity.BLOCKING, "Fixture"));
        var rendered = storage.resolve("renders/" + paper.getId() + "/reel.mp4");
        Files.createDirectories(rendered.getParent());
        Files.writeString(rendered, "Render fixture");
        var audio = storage.resolve("audio/" + asset.getId() + "/scene-1.mp3");
        Files.createDirectories(audio.getParent());
        Files.writeString(audio, "Audio fixture");
        var shared = storage.resolve("broll/shared-" + paper.getId() + ".mp4");
        Files.writeString(shared, "Shared fixture");

        service.delete(paper.getId(), "Laasya");

        assertFalse(papers.existsById(paper.getId()));
        assertFalse(claims.existsById(claim.getId()));
        assertTrue(passages.findByPaperIdOrderByOrdAsc(paper.getId()).isEmpty());
        assertFalse(assets.existsById(asset.getId()));
        assertTrue(violations.findByAssetId(asset.getId()).isEmpty());
        assertTrue(links.findByAssetId(asset.getId()).isEmpty());
        assertFalse(Files.exists(pdf));
        assertFalse(Files.exists(rendered));
        assertFalse(Files.exists(audio));
        assertTrue(Files.exists(shared));
        assertEquals("PAPER_DELETED", audit.getAuditHistory(paper.getId()).getFirst().action());
    }

    @Test
    void failedDatabaseDeletionRestoresStagedFiles() {
        var claim = relatedClaim();
        var other = new PaperEntity(paper.getId() + "-OTHER", "papers/other.pdf", PaperStatus.AWAITING_ASSET_REVIEW);
        papers.save(other);
        var asset = new AssetEntity();
        asset.setId("A-" + other.getId());
        asset.setPaperId(other.getId());
        asset.setType(AssetType.CAPTION);
        asset.setContent("{}");
        assets.save(asset);
        links.save(new AssetClaimEntity(asset.getId(), claim.getId(), "caption:p1"));
        assertThrows(RuntimeException.class, () -> service.delete(paper.getId(), "Laasya"));
        assertTrue(papers.existsById(paper.getId()));
        assertTrue(Files.exists(pdf));
        assertTrue(audit.getAuditHistory(paper.getId()).isEmpty());
    }

    @Test
    void processingPapersCannotBeDeleted() {
        paper.setStatus(PaperStatus.RENDERING);
        papers.save(paper);
        var error = assertThrows(ApiException.class, () -> service.delete(paper.getId(), "Laasya"));
        assertEquals("PAPER_PROCESSING", error.getErrorCode());
        assertTrue(Files.exists(pdf));
        assertTrue(papers.existsById(paper.getId()));
    }

    @Test
    void identifiersRemainMonotonicAcrossGeneratorRestarts() {
        long first = Long.parseLong(ids.nextPaperId().substring(2));
        long next = Long.parseLong(new IdGenerator(jdbc).nextPaperId().substring(2));
        assertTrue(next > first);
    }
}
