package com.steerclub.steerproof.common;

import com.steerclub.steerproof.paper.PaperRepository;
import com.steerclub.steerproof.pipeline.MlServiceClient;
import com.steerclub.steerproof.pipeline.RenderServiceClient;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "app.processing.mode=api")
@AutoConfigureMockMvc
@Transactional
class ProcessingAvailabilityIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired PaperRepository papers;
    @Autowired MlServiceClient ml;
    @Autowired RenderServiceClient render;
    @Autowired com.steerclub.steerproof.claim.ClaimRepository claims;
    @Autowired com.steerclub.steerproof.passage.PassageRepository passages;

    @Test void livenessAndCapabilitiesDoNotNeedWorkers() throws Exception {
        mvc.perform(get("/health")).andExpect(status().isOk()).andExpect(jsonPath("$.service").value("api"));
        mvc.perform(get("/api/capabilities")).andExpect(status().isOk())
                .andExpect(jsonPath("$.processingEnabled").value(false));
    }

    @Test void unavailableProcessingDoesNotCreateOrMutatePapers() throws Exception {
        long before = papers.count();
        var file = new MockMultipartFile("file", "paper.pdf", "application/pdf", "%PDF-test".getBytes());
        mvc.perform(multipart("/api/papers").file(file)).andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error").value("PROCESSING_UNAVAILABLE"));
        for (String path : new String[]{"/api/papers/P-9999/generate", "/api/papers/P-9999/retry",
                "/api/assets/A-9999-CAR/regenerate"}) {
            mvc.perform(post(path)).andExpect(status().isServiceUnavailable());
        }
        assertEquals(before, papers.count());
    }

    @Test void internalClientsCannotBypassAvailabilityOrSkipVerification() {
        assertThrows(ApiException.class, () -> ml.parse("P-9999", "paper.pdf"));
        assertThrows(ApiException.class, () -> ml.verify("P-9999", java.util.List.of(), java.util.List.of()));
        assertThrows(ApiException.class, () -> render.renderStatic("P-9999", Map.of(), "", true));
        assertNull(ml.geminiModel());
        assertTrue(new ProcessingAvailability("full").enabled());
    }

    @Test
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void evidenceRelinkingFailsClosedWhenVerificationCannotRun() throws Exception {
        String suffix = java.util.UUID.randomUUID().toString();
        String paperId = "P-API-" + suffix, passageId = "E-API-" + suffix, claimId = "C-API-" + suffix;
        papers.save(new com.steerclub.steerproof.paper.PaperEntity(paperId, "papers/fixture.pdf", PaperStatus.AWAITING_CLAIM_REVIEW));
        passages.save(new com.steerclub.steerproof.passage.PassageEntity(passageId, paperId, null, "paragraph", 1,
                "{}", 600f, 800f, "An isolated verification fixture.", 1));
        var claim = new com.steerclub.steerproof.claim.ClaimEntity();
        claim.setId(claimId);
        claim.setPaperId(paperId);
        claim.setPassageId(passageId);
        claim.setQuote("An isolated verification fixture.");
        claim.setScientificClaim("An isolated verification fixture.");
        claim.setFindingClass(FindingClass.BACKGROUND);
        claim.setDoctorStatus(DoctorStatus.NEEDS_EVIDENCE);
        claims.save(claim);
        mvc.perform(patch("/api/claims/" + claimId).contentType("application/json")
                .content("{\"action\":\"EDIT\",\"editedCopy\":\"edited fixture\"}"))
                .andExpect(status().isConflict());
        mvc.perform(patch("/api/claims/" + claimId).contentType("application/json")
                .content("{\"action\":\"EDIT\",\"passageId\":\"" + passageId + "\",\"editedCopy\":\"edited fixture\"}"))
                .andExpect(status().isServiceUnavailable());
        var unchanged = claims.findById(claimId).orElseThrow();
        assertEquals(DoctorStatus.NEEDS_EVIDENCE, unchanged.getDoctorStatus());
        assertNull(unchanged.getEditedCopy());
    }
}
