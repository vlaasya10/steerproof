package com.steerclub.steerproof.review;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.steerclub.steerproof.asset.*;
import com.steerclub.steerproof.audit.AuditService;
import com.steerclub.steerproof.claim.*;
import com.steerclub.steerproof.common.*;
import com.steerclub.steerproof.export.ExportController;
import com.steerclub.steerproof.paper.*;
import com.steerclub.steerproof.pipeline.PipelineService;
import com.steerclub.steerproof.policy.*;
import com.steerclub.steerproof.storage.StorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpStatus;

import java.util.UUID;
import java.util.zip.ZipFile;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@SpringBootTest
class PolicyOverrideIntegrationTest {
    @Autowired AssetController controller;
    @Autowired ExportController exports;
    @Autowired PaperRepository papers;
    @Autowired AssetRepository assets;
    @Autowired ClaimRepository claims;
    @Autowired AssetClaimRepository links;
    @Autowired PolicyViolationRepository violations;
    @Autowired AuditService audit;
    @Autowired StorageService storage;
    @Autowired ObjectMapper mapper;
    @MockBean PipelineService pipeline;

    private AssetEntity asset;
    private ClaimEntity claim;
    private PolicyViolationEntity blocking;

    @BeforeEach
    void fixture() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String paperId = "P-OVR-" + suffix;
        papers.save(new PaperEntity(paperId, "papers/fixture.pdf", PaperStatus.AWAITING_ASSET_REVIEW));
        claim = new ClaimEntity();
        claim.setId("C-OVR-" + suffix);
        claim.setPaperId(paperId);
        claim.setQuote("A source passage for a review fixture.");
        claim.setScientificClaim("A fixture claim.");
        claim.setFindingClass(FindingClass.PRIMARY);
        claim.setDoctorStatus(DoctorStatus.APPROVED);
        claims.save(claim);
        asset = new AssetEntity();
        asset.setId("A-OVR-" + suffix);
        asset.setPaperId(paperId);
        asset.setType(AssetType.CAPTION);
        asset.setContent("{}");
        asset.setStatus(AssetStatus.BLOCKED);
        assets.save(asset);
        links.save(new AssetClaimEntity(asset.getId(), claim.getId(), "caption:p1"));
        blocking = violations.save(new PolicyViolationEntity(asset.getId(), null, "caption:p1",
                "LENGTH", Severity.BLOCKING, "Copy exceeds the configured limit"));
    }

    @Test
    void bulkOverrideApprovesAndExportsTheAuditTrail() throws Exception {
        violations.save(new PolicyViolationEntity(asset.getId(), null, "caption:p1",
                "CAUSAL_ON_ASSOCIATION", Severity.WARNING, "Review phrasing"));
        assertEquals(HttpStatus.OK, controller.approveAsset(asset.getId(),
                new AssetController.AssetApprovalRequest("Laasya", 10, true, true)).getStatusCode());
        assertEquals(AssetStatus.APPROVED, assets.findById(asset.getId()).orElseThrow().getStatus());
        assertTrue(violations.findByAssetId(asset.getId()).stream().allMatch(PolicyViolationEntity::getResolved));
        var entries = audit.getAuditHistory(asset.getId()).stream().filter(e -> e.action().equals("POLICY_OVERRIDE")).toList();
        assertEquals(2, entries.size());
        assertTrue(entries.stream().allMatch(e -> e.actor().equals("Laasya") && e.at() != null));
        assertEquals(HttpStatus.OK, exports.exportPaper(asset.getPaperId()).getStatusCode());
        try (var zip = new ZipFile(storage.getRootPath().resolve("exports/" + asset.getPaperId() + ".zip").toFile())) {
            var report = mapper.readTree(zip.getInputStream(zip.getEntry("review_report.json")));
            assertEquals(2, report.path("assets").get(0).path("policyOverrides").size());
            assertEquals(2, report.path("assets").get(0).path("violationsOverridden").size());
        }
    }

    @Test
    void individualOverrideIsAuditedAndAllowsNormalApproval() {
        var request = new AssetController.PolicyApprovalRequest("Laasya");
        controller.approveViolation(asset.getId(), blocking.getId(), request);
        controller.approveViolation(asset.getId(), blocking.getId(), request);
        assertEquals(1, audit.getAuditHistory(asset.getId()).stream().filter(e -> e.action().equals("POLICY_OVERRIDE")).count());
        assertEquals(AssetStatus.BLOCKED, assets.findById(asset.getId()).orElseThrow().getStatus());
        assertEquals(HttpStatus.OK, controller.approveAsset(asset.getId(),
                new AssetController.AssetApprovalRequest("Laasya", 3, false, false)).getStatusCode());
    }

    @Test
    void unresolvedBlockingIssueRequiresExplicitOverride() {
        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, controller.approveAsset(asset.getId(),
                new AssetController.AssetApprovalRequest("Laasya", 3, true, false)).getStatusCode());
        assertFalse(violations.findById(blocking.getId()).orElseThrow().getResolved());
    }

    @ParameterizedTest
    @EnumSource(value = DoctorStatus.class, names = {"PENDING", "NEEDS_EVIDENCE", "REJECTED"})
    void overridesNeverBypassClaimApprovalOrExportChecks(DoctorStatus status) {
        claim.setDoctorStatus(status);
        claims.save(claim);
        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, controller.approveAsset(asset.getId(),
                new AssetController.AssetApprovalRequest("Laasya", 3, true, true)).getStatusCode());
        assertFalse(violations.findById(blocking.getId()).orElseThrow().getResolved());
        asset.setStatus(AssetStatus.APPROVED);
        assets.save(asset);
        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, exports.exportPaper(asset.getPaperId()).getStatusCode());
    }

    @ParameterizedTest
    @EnumSource(value = AssetStatus.class, names = {"DRAFT", "STALE"})
    void overridesNeverBypassStaleOrUnrenderedStatus(AssetStatus status) {
        asset.setStatus(status);
        assets.save(asset);
        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, controller.approveAsset(asset.getId(),
                new AssetController.AssetApprovalRequest("Laasya", 3, true, true)).getStatusCode());
    }

    @Test
    void renderingFailureRollsBackApprovalAndOverrides() throws Exception {
        doThrow(new RuntimeException("Renderer unavailable")).when(pipeline).reRenderAsset(any(), eq(false));
        ApiException error = assertThrows(ApiException.class, () -> controller.approveAsset(asset.getId(),
                new AssetController.AssetApprovalRequest("Laasya", 3, true, true)));
        assertEquals("APPROVAL_RENDER_FAILED", error.getErrorCode());
        assertEquals(AssetStatus.BLOCKED, assets.findById(asset.getId()).orElseThrow().getStatus());
        assertFalse(violations.findById(blocking.getId()).orElseThrow().getResolved());
        assertTrue(audit.getAuditHistory(asset.getId()).isEmpty());
    }

    @Test
    void cannotApproveAnotherAssetsViolation() {
        var other = new AssetEntity();
        other.setId(asset.getId() + "-OTHER");
        other.setPaperId(asset.getPaperId());
        other.setType(AssetType.STATIC);
        other.setContent("{}");
        assets.save(other);
        var error = assertThrows(ApiException.class, () -> controller.approveViolation(other.getId(), blocking.getId(),
                new AssetController.PolicyApprovalRequest("Laasya")));
        assertEquals(HttpStatus.NOT_FOUND, error.getStatus());
        assertFalse(violations.findById(blocking.getId()).orElseThrow().getResolved());
    }
}
