package com.example.stream.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Health check endpoint for the OpenDrive log streaming service.
 * This service consumes logs from Kafka and forwards them to Loki.
 */
@RestController
@RequestMapping("/api")
public class KafkaController {

    @GetMapping("/health")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("OpenDrive Log Service is running");
    }
}
