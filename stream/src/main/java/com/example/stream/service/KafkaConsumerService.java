package com.example.stream.service;

import com.example.stream.config.KafkaConfig;
import com.example.stream.model.LogMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Service;

@Service
@Slf4j
@RequiredArgsConstructor
public class KafkaConsumerService {

    private final LokiService lokiService;
    private final KafkaConfig kafkaConfig;

    /**
     * Listen to critical logs (errors + warnings)
     */
    @KafkaListener(
        topics = "#{kafkaConfig.getCriticalTopic()}",
        groupId = "${spring.kafka.consumer.group-id:stream-consumer-group}"
    )
    public void consumeCriticalLogs(
        @Payload LogMessage logMessage,
        @Header(KafkaHeaders.RECEIVED_TOPIC) String topic,
        @Header(KafkaHeaders.RECEIVED_PARTITION) int partition,
        @Header(KafkaHeaders.OFFSET) long offset
    ) {
        log.info("📛 Received CRITICAL log from topic={}, partition={}, offset={}", topic, partition, offset);
        log.debug("Critical log: level={}, message={}", logMessage.getLevel(), logMessage.getMessage());

        // Forward to Loki
        lokiService.pushLog(logMessage, topic);
    }

    /**
     * Listen to info logs (general application flow)
     */
    @KafkaListener(
        topics = "#{kafkaConfig.getInfoTopic()}",
        groupId = "${spring.kafka.consumer.group-id:stream-consumer-group}"
    )
    public void consumeInfoLogs(
        @Payload LogMessage logMessage,
        @Header(KafkaHeaders.RECEIVED_TOPIC) String topic,
        @Header(KafkaHeaders.RECEIVED_PARTITION) int partition,
        @Header(KafkaHeaders.OFFSET) long offset
    ) {
        log.debug("ℹ️ Received INFO log from topic={}, partition={}, offset={}", topic, partition, offset);

        // Forward to Loki
        lokiService.pushLog(logMessage, topic);
    }

    /**
     * Listen to debug logs (verbose debugging)
     */
    @KafkaListener(
        topics = "#{kafkaConfig.getDebugTopic()}",
        groupId = "${spring.kafka.consumer.group-id:stream-consumer-group}"
    )
    public void consumeDebugLogs(
        @Payload LogMessage logMessage,
        @Header(KafkaHeaders.RECEIVED_TOPIC) String topic,
        @Header(KafkaHeaders.RECEIVED_PARTITION) int partition,
        @Header(KafkaHeaders.OFFSET) long offset
    ) {
        log.debug("🐛 Received DEBUG log from topic={}, partition={}, offset={}", topic, partition, offset);

        // Forward to Loki
        lokiService.pushLog(logMessage, topic);
    }
}
