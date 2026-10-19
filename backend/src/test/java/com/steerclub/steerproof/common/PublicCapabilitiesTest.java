package com.steerclub.steerproof.common;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class PublicCapabilitiesTest {
    private MockMvc api(String mode, boolean protectedWorkspace) {
        var auth = new WorkspaceAuth(protectedWorkspace ? "long-test-workspace-secret-not-public" : "", protectedWorkspace);
        return MockMvcBuilders.standaloneSetup(new RuntimeController(new ProcessingAvailability(mode), true, auth))
                .addFilters(new WorkspaceAuthFilter(auth, new ObjectMapper())).build();
    }

    @Test void anonymousApiModeDisclosesOnlySafeConfiguration() throws Exception {
        api("api", true).perform(get("/api/public/capabilities")).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$.mode").value("api"))
                .andExpect(jsonPath("$.processingEnabled").value(false))
                .andExpect(jsonPath("$.authenticationRequired").value(true));
    }

    @Test void publicExceptionDoesNotAuthorizePrivateOperationsOrOtherMethods() throws Exception {
        var mvc = api("full", true);
        mvc.perform(get("/api/public/capabilities")).andExpect(status().isOk())
                .andExpect(jsonPath("$.processingEnabled").value(true))
                .andExpect(jsonPath("$.authenticationRequired").value(true));
        mvc.perform(post("/api/public/capabilities")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/public/capabilities/anything")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/capabilities")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/papers")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/papers")).andExpect(status().isUnauthorized());
    }

    @Test void localFullModeAdvertisesTheExistingOpenProcessingEnvironment() throws Exception {
        api("full", false).perform(get("/api/public/capabilities")).andExpect(status().isOk())
                .andExpect(jsonPath("$.processingEnabled").value(true))
                .andExpect(jsonPath("$.authenticationRequired").value(false));
    }
}
