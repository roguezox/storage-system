#!/bin/bash

# Script to run the application with local Kafka (Docker)

echo "🐳 Checking if Docker is running..."
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running!"
    echo "📝 Please start Docker and try again"
    exit 1
fi

echo "✅ Docker is running"
echo ""

# Check if Kafka is already running
if docker ps | grep -q kafka; then
    echo "✅ Kafka is already running"
else
    echo "🚀 Starting Kafka infrastructure with Docker Compose..."
    docker-compose up -d

    echo ""
    echo "⏳ Waiting for Kafka to be ready (this may take 30-60 seconds)..."
    sleep 30

    echo "✅ Kafka infrastructure started"
fi

echo ""
echo "📊 Kafka UI available at: http://localhost:8090"
echo "🚀 Starting Spring Boot application..."
echo ""

# Run the application with default profile (local)
./mvnw spring-boot:run
