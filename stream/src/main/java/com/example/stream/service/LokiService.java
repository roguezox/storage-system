package com.example.stream.service;

import com.example.stream.model.LogMessage;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class LokiService {

    @Value("${loki.url:http://loki:3100}")
    private String lokiUrl;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Push log to Loki
     * Loki API: POST /loki/api/v1/push
     */
    public void pushLog(LogMessage logMessage, String topic) {
        try {
            // Build Loki push request
            Map<String, Object> lokiRequest = buildLokiRequest(logMessage, topic);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(lokiRequest, headers);

            // Send to Loki
            String url = lokiUrl + "/loki/api/v1/push";
            restTemplate.postForEntity(url, request, String.class);

            log.debug("Successfully pushed log to Loki: level={}, message={}",
                logMessage.getLevel(), logMessage.getMessage());

        } catch (Exception e) {
            log.error("Failed to push log to Loki: {}", e.getMessage());
        }
    }

    /**
     * Build Loki push request in the required format
     * https://grafana.com/docs/loki/latest/api/#push-log-entries-to-loki
     * 
     * Expected format:
     * {
     *   "streams": [{
     *     "stream": { "job": "opendrive", "level": "info", ... },
     *     "values": [[ "<timestamp_ns>", "<log_line>" ]]
     *   }]
     * }
     */
    private Map<String, Object> buildLokiRequest(LogMessage logMessage, String topic) throws JsonProcessingException {
        // Labels for the log stream - passed directly as key-value pairs
        Map<String, String> labels = new HashMap<>();
        labels.put("job", "opendrive");
        labels.put("level", logMessage.getLevel() != null ? logMessage.getLevel() : "info");
        labels.put("service", logMessage.getService() != null ? logMessage.getService() : "unknown");
        labels.put("environment", logMessage.getEnvironment() != null ? logMessage.getEnvironment() : "production");
        labels.put("topic", topic);

        // Timestamp in nanoseconds
        String timestamp = String.valueOf(System.currentTimeMillis() * 1_000_000);

        // Log line (JSON string)
        String logLine = objectMapper.writeValueAsString(logMessage);

        // Build stream - labels go directly under "stream" as key-value pairs
        Map<String, Object> streamEntry = new HashMap<>();
        streamEntry.put("stream", labels);  // Labels as direct map, not nested
        streamEntry.put("values", List.of(List.of(timestamp, logLine)));

        // Build request
        Map<String, Object> request = new HashMap<>();
        request.put("streams", List.of(streamEntry));

        return request;
    }
}
