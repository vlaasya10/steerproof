package com.steerclub.steerproof.pipeline;

import com.steerclub.steerproof.audit.AuditService;
import com.steerclub.steerproof.common.PaperStatus;
import com.steerclub.steerproof.paper.*;
import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class PipelineRecoveryTest {
    @Test void interruptedStagesBecomeRetryableWithoutChangingCompletedPapers() {
        var repository = mock(PaperRepository.class);
        var audit = mock(AuditService.class);
        var papers = new ArrayList<PaperEntity>();
        for (var status : new PaperStatus[]{PaperStatus.PARSING, PaperStatus.EXTRACTING, PaperStatus.VERIFYING,
                PaperStatus.WRITING, PaperStatus.RENDERING, PaperStatus.AWAITING_ASSET_REVIEW}) {
            papers.add(new PaperEntity("P-" + status, "papers/fixture.pdf", status));
        }
        when(repository.findAll()).thenReturn(papers);
        new PipelineRecovery(repository, audit).recover();
        assertEquals(5, papers.stream().filter(p -> p.getStatus() == PaperStatus.FAILED && p.getFailedStage() != null).count());
        assertEquals(PaperStatus.AWAITING_ASSET_REVIEW, papers.getLast().getStatus());
        verify(audit, times(5)).log(eq("system"), eq("PIPELINE_INTERRUPTED"), eq("paper"), anyString(), any(), any());
    }
}
