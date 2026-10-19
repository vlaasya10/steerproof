package com.steerclub.steerproof.common;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class ProcessingAvailability {
    public static final String MESSAGE = "This server runs in API-only mode. The complete pipeline cannot reliably run within Render Free's 512 MB limit. "
            + "PDF processing, Gemini extraction, evidence verification, content generation and image/video rendering "
            + "require full mode on a machine with more memory. Scientific checks are never skipped. "
            + "Existing records and claim reviews remain available; files in temporary storage can be lost on restart.";
    private final String mode;
    public ProcessingAvailability(@Value("${app.processing.mode:full}") String mode) {
        if (!mode.equals("api") && !mode.equals("full")) throw new IllegalArgumentException("Processing mode must be api or full");
        this.mode = mode;
    }
    public boolean enabled() { return mode.equals("full"); }
    public String mode() { return mode; }
    public void requireProcessing() {
        if (!enabled()) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "PROCESSING_UNAVAILABLE", MESSAGE);
    }
}
