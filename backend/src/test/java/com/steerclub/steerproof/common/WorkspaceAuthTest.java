package com.steerclub.steerproof.common;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import static org.junit.jupiter.api.Assertions.*;

class WorkspaceAuthTest {
    private static final String PASSWORD = "a-long-random-workspace-password-for-tests";
    private final WorkspaceAuth auth = new WorkspaceAuth(PASSWORD, true);

    private int request(String path, String bearer, String media) throws Exception {
        var request = new MockHttpServletRequest("GET", path);
        if (bearer != null) request.addHeader("Authorization", "Bearer " + bearer);
        if (media != null) request.setParameter("access_token", media);
        var response = new MockHttpServletResponse();
        new WorkspaceAuthFilter(auth, new ObjectMapper()).doFilter(request, response, (req, res) -> response.setStatus(204));
        return response.getStatus();
    }

    @Test void productionRequiresASecret() {
        assertThrows(IllegalArgumentException.class, () -> new WorkspaceAuth("", true));
        assertThrows(IllegalArgumentException.class, () -> new WorkspaceAuth("short", true));
        assertFalse(new WorkspaceAuth("", false).enabled());
    }

    @Test void loginRejectsWrongPasswords() {
        assertThrows(ApiException.class, () -> auth.login("incorrect"));
    }

    @Test void sessionsAreSignedAndScopeSeparated() {
        var session = auth.login(PASSWORD);
        assertTrue(auth.valid(session.token(), "api"));
        assertTrue(auth.valid(session.mediaToken(), "media"));
        assertFalse(auth.valid(session.token(), "media"));
        assertFalse(auth.valid(session.mediaToken(), "api"));
        assertFalse(auth.valid("x" + session.token(), "api"));
        assertFalse(new WorkspaceAuth(PASSWORD + "rotated", true).valid(session.token(), "api"));
        assertFalse(auth.valid("malformed", "api"));
    }

    @Test void publicHealthAndLoginConfigurationRemainAccessible() throws Exception {
        assertEquals(204, request("/actuator/health", null, null));
        assertEquals(204, request("/api/auth/config", null, null));
        assertEquals(401, request("/api/papers", null, null));
        assertEquals(401, request("/files/papers/P-0001.pdf", null, null));
    }

    @Test void mediaTokensCannotAuthorizeApiChanges() throws Exception {
        var session = auth.login(PASSWORD);
        assertEquals(204, request("/files/renders/P-0001/reel.mp4", null, session.mediaToken()));
        assertEquals(401, request("/api/papers/P-0001", null, session.mediaToken()));
        assertEquals(401, request("/api/papers/P-0001", session.mediaToken(), null));
        assertEquals(204, request("/api/papers/P-0001", session.token(), null));
    }
}
