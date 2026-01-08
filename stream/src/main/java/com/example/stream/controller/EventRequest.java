package com.example.stream.controller;

import lombok.Data;

@Data
public class EventRequest {
    private String eventType;
    private String payload;
}
