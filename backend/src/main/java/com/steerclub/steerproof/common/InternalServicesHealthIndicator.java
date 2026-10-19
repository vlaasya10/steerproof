package com.steerclub.steerproof.common;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import java.time.Duration;
import java.util.List;
import java.util.Map;

@Component
@Profile("prod")
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name = "app.health.check-processing", havingValue = "true")
public class InternalServicesHealthIndicator implements HealthIndicator {
    private final RestClient client;
    private final List<String> urls;
    public InternalServicesHealthIndicator(@Value("${app.ml-service.url}") String ml,
                                           @Value("${app.render-service.url}") String render) {
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(2));
        factory.setReadTimeout(Duration.ofSeconds(2));
        client = RestClient.builder().requestFactory(factory).build();
        urls = List.of(ml + "/health", render + "/health");
    }
    @Override public Health health() {
        try {
            for (String url : urls) {
                Map<?, ?> response = client.get().uri(url).retrieve().body(Map.class);
                if (response == null || !"ok".equals(response.get("status"))) return Health.down().build();
            }
            return Health.up().build();
        } catch (Exception error) { return Health.down().build(); }
    }
}
