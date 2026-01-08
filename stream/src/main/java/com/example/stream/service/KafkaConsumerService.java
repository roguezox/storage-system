package com.example.stream.service;

import com.example.stream.config.KafkaConfig;
import com.example.stream.model.Event;
import com.example.stream.model.Message;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class KafkaConsumerService {

    @KafkaListener(topics = KafkaConfig.MESSAGES_TOPIC, groupId = "stream-consumer-group")
    public void consumeMessage(@Payload Message message,
                               @Header(KafkaHeaders.RECEIVED_PARTITION) int partition,
                               @Header(KafkaHeaders.OFFSET) long offset) {
        log.info("Received message from partition {}, offset {}: {}", partition, offset, message);

        // Process the message here
        processMessage(message);
    }

    @KafkaListener(topics = KafkaConfig.EVENTS_TOPIC, groupId = "stream-consumer-group")
    public void consumeEvent(@Payload Event event,
                             @Header(KafkaHeaders.RECEIVED_PARTITION) int partition,
                             @Header(KafkaHeaders.OFFSET) long offset) {
        log.info("Received event from partition {}, offset {}: {}", partition, offset, event);

        // Process the event here
        processEvent(event);
    }

    private void processMessage(Message message) {
        log.info("Processing message: id={}, sender={}, content={}",
            message.getId(), message.getSender(), message.getContent());

        // Add your business logic here
    }

    private void processEvent(Event event) {
        log.info("Processing event: eventId={}, eventType={}, payload={}",
            event.getEventId(), event.getEventType(), event.getPayload());

        // Add your business logic here
    }
}
