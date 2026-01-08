package com.example.stream.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class LogMessage {
    private String level;
    private String message;
    private String timestamp;
    private String service;
    private String environment;
    private String component;

    // Additional fields from Winston
    private Object meta;
    private String stack;
}
