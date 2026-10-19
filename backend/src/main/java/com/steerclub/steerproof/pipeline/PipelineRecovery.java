package com.steerclub.steerproof.pipeline;

import com.steerclub.steerproof.paper.PaperRepository;
import com.steerclub.steerproof.audit.AuditService;
import com.steerclub.steerproof.common.PaperStatus;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import java.util.Map;

/** The deployment runs one worker instance. Interrupted stages become explicitly retryable. */
@Component
@Profile("prod")
public class PipelineRecovery {
    private final PaperRepository papers;
    private final AuditService audit;
    public PipelineRecovery(PaperRepository papers, AuditService audit) { this.papers = papers; this.audit = audit; }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void recover() {
        Map<PaperStatus, String> stages = Map.of(PaperStatus.PARSING, "PARSE", PaperStatus.EXTRACTING, "EXTRACT",
                PaperStatus.VERIFYING, "VERIFY", PaperStatus.WRITING, "WRITE", PaperStatus.RENDERING, "RENDER");
        for (var paper : papers.findAll()) {
            String stage = stages.get(paper.getStatus());
            if (stage == null) continue;
            String before = paper.getStatus().name();
            paper.setFailedStage(stage);
            paper.setError("Service restarted during " + stage + ". Retry this stage to resume.");
            paper.setStatus(PaperStatus.FAILED);
            papers.save(paper);
            audit.log("system", "PIPELINE_INTERRUPTED", "paper", paper.getId(), Map.of("status", before),
                    Map.of("status", "FAILED", "failedStage", stage));
        }
    }
}
