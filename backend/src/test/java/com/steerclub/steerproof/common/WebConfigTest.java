package com.steerclub.steerproof.common;

import org.junit.jupiter.api.Test;
import org.springframework.core.Ordered;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import static org.junit.jupiter.api.Assertions.*;

class WebConfigTest {
    @Test
    void acceptsOnlyConfiguredDeploymentOrigins() throws Exception {
        var request = new MockHttpServletRequest("GET", "/api/papers");
        request.addHeader("Origin", "https://steerproof.vercel.app");
        var response = new MockHttpServletResponse();
        new WebConfig("https://steerproof.vercel.app").corsFilter().getFilter().doFilter(request, response, (req, res) -> {});
        assertEquals("https://steerproof.vercel.app", response.getHeader("Access-Control-Allow-Origin"));
        assertThrows(IllegalArgumentException.class, () -> new WebConfig("*"));
    }
    @Test
    void includesCorsHeadersWhenDownstreamUploadFails() throws Exception {
        var registration = new WebConfig().corsFilter();
        assertEquals(Ordered.HIGHEST_PRECEDENCE, registration.getOrder());
        var request = new MockHttpServletRequest("POST", "/api/papers");
        request.addHeader("Origin", "http://localhost:3000");
        var response = new MockHttpServletResponse();
        registration.getFilter().doFilter(request, response, (req, res) -> {
            var error = new GlobalExceptionHandler().handleUploadTooLarge(new MaxUploadSizeExceededException(25));
            response.setStatus(error.getStatusCode().value());
            assertEquals("UPLOAD_TOO_LARGE", error.getBody().error());
        });
        assertEquals(413, response.getStatus());
        assertEquals("http://localhost:3000", response.getHeader("Access-Control-Allow-Origin"));
    }

    @Test
    void handlesPreflightBeforeMvc() throws Exception {
        var request = new MockHttpServletRequest("OPTIONS", "/api/papers");
        request.addHeader("Origin", "http://127.0.0.1:3000");
        request.addHeader("Access-Control-Request-Method", "POST");
        request.addHeader("Access-Control-Request-Headers", "content-type");
        var response = new MockHttpServletResponse();
        new WebConfig().corsFilter().getFilter().doFilter(request, response,
                (req, res) -> fail("Preflight must not reach MVC"));
        assertEquals(200, response.getStatus());
        assertEquals("http://127.0.0.1:3000", response.getHeader("Access-Control-Allow-Origin"));
        assertTrue(response.getHeader("Access-Control-Allow-Methods").contains("POST"));
    }

    @Test
    void rejectsUntrustedOrigins() throws Exception {
        var request = new MockHttpServletRequest("GET", "/api/papers");
        request.addHeader("Origin", "https://untrusted.example");
        var response = new MockHttpServletResponse();
        new WebConfig().corsFilter().getFilter().doFilter(request, response,
                (req, res) -> fail("Untrusted origin must not reach MVC"));
        assertEquals(403, response.getStatus());
        assertNull(response.getHeader("Access-Control-Allow-Origin"));
    }
}
