package com.example.stream.controller;

import lombok.Data;

@Data
public class MessageRequest {
    private String content;
    private String sender;
}
