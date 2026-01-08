package com.example.stream.controller;

import com.example.stream.model.Event;
import com.example.stream.model.Message;
import com.example.stream.service.KafkaProducerService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.UUID;

@RestController
@RequestMapping("/api/kafka")
@RequiredArgsConstructor
public class KafkaController {

    private final KafkaProducerService producerService;

    @PostMapping("/messages")
    public ResponseEntity<String> sendMessage(@RequestBody MessageRequest request) {
        Message message = Message.builder()
            .id(UUID.randomUUID().toString())
            .content(request.getContent())
            .sender(request.getSender())
            .timestamp(LocalDateTime.now())
            .build();

        producerService.sendMessage(message);

        return ResponseEntity.ok("Message sent successfully");
    }

    @PostMapping("/events")
    public ResponseEntity<String> sendEvent(@RequestBody EventRequest request) {
        Event event = Event.builder()
            .eventId(UUID.randomUUID().toString())
            .eventType(request.getEventType())
            .payload(request.getPayload())
            .occurredAt(LocalDateTime.now())
            .build();

        producerService.sendEvent(event);

        return ResponseEntity.ok("Event sent successfully");
    }

    @GetMapping("/health")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("Kafka service is running");
    }
}
