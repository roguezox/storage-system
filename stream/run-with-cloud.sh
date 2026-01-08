#!/bin/bash

# Script to run the application with Confluent Cloud profile

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "📝 Please copy .env.example to .env and fill in your Confluent Cloud credentials:"
    echo "   cp .env.example .env"
    exit 1
fi

# Load environment variables from .env
echo "🔧 Loading environment variables from .env..."
export $(cat .env | grep -v '^#' | xargs)

# Verify required variables are set
if [ -z "$KAFKA_BOOTSTRAP_SERVERS" ] || [ -z "$KAFKA_API_KEY" ] || [ -z "$KAFKA_API_SECRET" ]; then
    echo "❌ Error: Required environment variables are not set!"
    echo "📝 Please ensure your .env file contains:"
    echo "   - KAFKA_BOOTSTRAP_SERVERS"
    echo "   - KAFKA_API_KEY"
    echo "   - KAFKA_API_SECRET"
    exit 1
fi

echo "✅ Environment variables loaded successfully"
echo "🚀 Starting application with Confluent Cloud profile..."
echo ""

# Run the application with cloud profile
./mvnw spring-boot:run -Dspring-boot.run.profiles=cloud
