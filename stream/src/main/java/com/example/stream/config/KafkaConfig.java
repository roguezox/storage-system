package com.example.stream.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

@Configuration
public class KafkaConfig {

    // Topic names configured via environment variables
    @Value("${kafka.topic.base:opendrive-logs}")
    private String baseTopic;

    public String getCriticalTopic() {
        return baseTopic + "-critical";
    }

    public String getInfoTopic() {
        return baseTopic + "-info";
    }

    public String getDebugTopic() {
        return baseTopic + "-debug";
    }
}
