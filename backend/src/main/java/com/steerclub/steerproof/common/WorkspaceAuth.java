package com.steerclub.steerproof.common;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

/** Shared workspace access for a private deployment; reviewer labels remain separate. */
@Service
public class WorkspaceAuth {
    private final String password;
    private final byte[] secret;
    private static final long SESSION_SECONDS = 8 * 60 * 60;

    public WorkspaceAuth(@Value("${app.auth.access-key:}") String password,
                         @Value("${app.auth.required:false}") boolean required) {
        this.password = password.trim();
        if ((required || !this.password.isEmpty()) && this.password.length() < 32) {
            throw new IllegalArgumentException("DEPLOYMENT_ACCESS_KEY must contain at least 32 characters");
        }
        secret = digest(this.password);
    }

    public boolean enabled() { return !password.isEmpty(); }
    public record Session(String token, String mediaToken, Instant expiresAt) {}

    public Session login(String supplied) {
        if (!enabled() || supplied == null || !MessageDigest.isEqual(secret, digest(supplied.trim()))) {
            throw new ApiException(org.springframework.http.HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Incorrect workspace password");
        }
        Instant expiresAt = Instant.now().plusSeconds(SESSION_SECONDS);
        return new Session(issue("api", expiresAt), issue("media", expiresAt), expiresAt);
    }

    private String issue(String scope, Instant expiry) {
        String payload = Base64.getUrlEncoder().withoutPadding().encodeToString(
                (scope + ":" + expiry.getEpochSecond() + ":" + UUID.randomUUID()).getBytes(StandardCharsets.UTF_8));
        return payload + "." + Base64.getUrlEncoder().withoutPadding().encodeToString(sign(payload));
    }

    public boolean valid(String token, String scope) {
        if (token == null || token.length() > 512 || !enabled()) return false;
        try {
            String[] parts = token.split("\\.", -1);
            if (parts.length != 2 || !MessageDigest.isEqual(sign(parts[0]), Base64.getUrlDecoder().decode(parts[1]))) return false;
            String[] payload = new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8).split(":", -1);
            return payload.length == 3 && payload[0].equals(scope) && Long.parseLong(payload[1]) > Instant.now().getEpochSecond();
        } catch (IllegalArgumentException error) {
            return false;
        }
    }

    private byte[] sign(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return mac.doFinal(value.getBytes(StandardCharsets.UTF_8));
        } catch (Exception error) { throw new IllegalStateException("Cannot sign workspace session", error); }
    }

    private static byte[] digest(String value) {
        try { return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)); }
        catch (Exception error) { throw new IllegalStateException(error); }
    }
}
