# Stream - Spring Boot Kafka Application

A production-ready Spring Boot 3.5.0 application demonstrating integration with Apache Kafka using Spring Kafka and Confluent Platform.

## Features

- Spring Kafka integration with JSON serialization
- Producer and Consumer services
- REST API endpoints for message publishing
- Support for both local development and Confluent Cloud
- Docker Compose setup for local Kafka cluster
- Kafka UI for monitoring and management
- Schema Registry support ready
- Comprehensive error handling and logging

## Quick Start

Choose your deployment option:

### Option 1: Local Development (Docker)

Perfect for development and testing without any cloud setup.

```bash
# Start Kafka locally and run the application
./run-local.sh
```

**What you get:**
- Local Kafka cluster running in Docker
- Kafka UI at http://localhost:8090
- Application at http://localhost:8080
- No registration or credentials needed

See: [Full Local Setup Guide](README_KAFKA.md)

### Option 2: Confluent Cloud (Managed)

Production-ready managed Kafka service in the cloud.

```bash
# 1. Set up your Confluent Cloud credentials
cp .env.example .env
# Edit .env with your Confluent Cloud credentials

# 2. Run with Confluent Cloud
./run-with-cloud.sh
```

**What you get:**
- Fully managed Kafka cluster
- High availability and scalability
- Built-in monitoring and alerting
- $400 in free credits to start

See: [Full Confluent Cloud Setup Guide](README_CONFLUENT_CLOUD.md)

## Project Structure

```
src/main/java/com/example/stream/
├── config/
│   └── KafkaConfig.java              # Kafka topics configuration
├── controller/
│   ├── KafkaController.java          # REST API endpoints
│   ├── MessageRequest.java           # Message request DTO
│   └── EventRequest.java             # Event request DTO
├── model/
│   ├── Message.java                  # Message domain model
│   └── Event.java                    # Event domain model
├── service/
│   ├── KafkaProducerService.java     # Kafka producer service
│   └── KafkaConsumerService.java     # Kafka consumer service
└── StreamApplication.java            # Main application class

src/main/resources/
├── application.properties            # Default (local) configuration
└── application-cloud.yml             # Confluent Cloud configuration
```

## API Endpoints

### Send a Message

```bash
curl -X POST http://localhost:8080/api/kafka/messages \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Hello Kafka!",
    "sender": "John Doe"
  }'
```

### Send an Event

```bash
curl -X POST http://localhost:8080/api/kafka/events \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "USER_CREATED",
    "payload": "{\"userId\":\"123\",\"email\":\"user@example.com\"}"
  }'
```

### Health Check

```bash
curl http://localhost:8080/api/kafka/health
```

## Configuration

### Kafka Topics

Two topics are pre-configured:
- `messages-topic` - For general messages
- `events-topic` - For domain events

Both topics have:
- 3 partitions for parallel processing
- Replication factor of 1 (local) or as configured (cloud)

### Application Profiles

- **default** - Uses local Kafka (localhost:9092)
- **cloud** - Uses Confluent Cloud with SASL_SSL authentication

## Prerequisites

- Java 21
- Maven 3.x
- Docker & Docker Compose (for local development)
- Confluent Cloud account (for cloud deployment)

## Building

```bash
# Build the project
./mvnw clean install

# Build without tests
./mvnw clean install -DskipTests

# Run tests only
./mvnw test
```

## Running

### Manual Run

**Local Kafka:**
```bash
docker-compose up -d
./mvnw spring-boot:run
```

**Confluent Cloud:**
```bash
export $(cat .env | xargs)
./mvnw spring-boot:run -Dspring-boot.run.profiles=cloud
```

### Using Helper Scripts

**Local:**
```bash
./run-local.sh
```

**Cloud:**
```bash
./run-with-cloud.sh
```

## Monitoring

### Local Development

- **Kafka UI:** http://localhost:8090
  - View topics and messages
  - Monitor consumer groups
  - Browse Schema Registry (if enabled)

### Confluent Cloud

- **Confluent Cloud Console:** https://confluent.cloud
  - Real-time metrics and monitoring
  - Consumer lag tracking
  - Billing and usage analytics

### Application Logs

The application provides detailed logging:
- Message production with offset and partition info
- Message consumption with metadata
- Error handling and retry logic

## Development

### Adding New Topics

Edit `src/main/java/com/example/stream/config/KafkaConfig.java`:

```java
@Bean
public NewTopic myNewTopic() {
    return TopicBuilder.name("my-new-topic")
            .partitions(3)
            .replicas(1)
            .build();
}
```

### Adding New Message Types

1. Create model in `src/main/java/com/example/stream/model/`
2. Add producer method in `KafkaProducerService.java`
3. Add consumer method in `KafkaConsumerService.java`
4. Add REST endpoint in `KafkaController.java`

### Using Avro Serialization

To enable Avro with Schema Registry:

1. Uncomment Schema Registry configuration in `application.properties` or set in `.env`
2. Create Avro schemas in `src/main/resources/avro/`
3. Add Avro Maven plugin to `pom.xml`
4. Update serializers to `KafkaAvroSerializer` and `KafkaAvroDeserializer`

## Troubleshooting

### Local Kafka Issues

```bash
# Check if Kafka is running
docker ps | grep kafka

# View Kafka logs
docker logs kafka

# Restart Kafka
docker-compose restart kafka

# Full reset
docker-compose down -v
docker-compose up -d
```

### Confluent Cloud Issues

- Verify credentials in `.env` file
- Check API key permissions in Confluent Cloud Console
- Ensure topics exist in your cluster
- Verify bootstrap server URL is correct

## Security

- `.env` file is in `.gitignore` - never commit credentials
- Use separate API keys for dev/staging/production
- Rotate API keys regularly
- Enable audit logging in production

## Testing

```bash
# Run all tests
./mvnw test

# Run with coverage
./mvnw test jacoco:report

# Integration tests only
./mvnw verify -DskipUnitTests
```

## Production Considerations

- Use Confluent Cloud for production deployments
- Enable SSL/TLS for data in transit
- Configure appropriate retention policies
- Set up monitoring and alerting
- Use dedicated clusters for production workloads
- Implement circuit breakers and retry logic
- Configure appropriate replication factors (3+ for production)

## Resources

- [Spring Kafka Documentation](https://spring.io/projects/spring-kafka)
- [Confluent Documentation](https://docs.confluent.io/)
- [Apache Kafka Documentation](https://kafka.apache.org/documentation/)
- [Confluent Cloud](https://www.confluent.io/confluent-cloud/)

## License

This project is provided as-is for educational and demonstration purposes.

## Support

For issues and questions:
- Check the documentation in `README_KAFKA.md` or `README_CONFLUENT_CLOUD.md`
- Review Kafka logs and application logs
- Consult Spring Kafka and Confluent documentation
