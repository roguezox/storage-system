package com.example.stream.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
public class KafkaConfig {

    public static final String MESSAGES_TOPIC = "messages-topic";
    public static final String EVENTS_TOPIC = "events-topic";

    @Bean
    public NewTopic messagesTopic() {
        return TopicBuilder.name(MESSAGES_TOPIC)
                .partitions(3)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic eventsTopic() {
        return TopicBuilder.name(EVENTS_TOPIC)
                .partitions(3)
                .replicas(1)
                .build();
    }
}
