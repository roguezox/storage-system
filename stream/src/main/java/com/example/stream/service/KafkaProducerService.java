package com.example.stream.service;

import com.example.stream.config.KafkaConfig;
import com.example.stream.model.Event;
import com.example.stream.model.Message;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Service;

import java.util.concurrent.CompletableFuture;

@Service
@RequiredArgsConstructor
@Slf4j
public class KafkaProducerService {

    private final KafkaTemplate<String, Object> kafkaTemplate;

    public void sendMessage(Message message) {
        log.info("Sending message to topic {}: {}", KafkaConfig.MESSAGES_TOPIC, message);

        CompletableFuture<SendResult<String, Object>> future =
            kafkaTemplate.send(KafkaConfig.MESSAGES_TOPIC, message.getId(), message);

        future.whenComplete((result, ex) -> {
            if (ex == null) {
                log.info("Message sent successfully: offset={}, partition={}",
                    result.getRecordMetadata().offset(),
                    result.getRecordMetadata().partition());
            } else {
                log.error("Failed to send message", ex);
            }
        });
    }

    public void sendEvent(Event event) {
        log.info("Sending event to topic {}: {}", KafkaConfig.EVENTS_TOPIC, event);

        CompletableFuture<SendResult<String, Object>> future =
            kafkaTemplate.send(KafkaConfig.EVENTS_TOPIC, event.getEventId(), event);

        future.whenComplete((result, ex) -> {
            if (ex == null) {
                log.info("Event sent successfully: offset={}, partition={}",
                    result.getRecordMetadata().offset(),
                    result.getRecordMetadata().partition());
            } else {
                log.error("Failed to send event", ex);
            }
        });
    }
}
