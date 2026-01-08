# Confluent Kafka Spring Boot Starter Project

This is a starter project demonstrating integration of Confluent Kafka with Spring Boot 3.5.0 and Java 21.

## Features

- Spring Kafka integration with Confluent Platform
- Producer and Consumer services
- REST API endpoints for sending messages
- Docker Compose setup for local Kafka cluster
- Kafka UI for monitoring topics and messages
- Schema Registry support (optional)
- JSON serialization/deserialization

## Prerequisites

- Java 21
- Maven 3.x
- Docker and Docker Compose

## Project Structure

```
src/main/java/com/example/stream/
├── config/
│   └── KafkaConfig.java          # Kafka topics configuration
├── controller/
│   ├── KafkaController.java      # REST endpoints
│   ├── MessageRequest.java       # Request DTO
│   └── EventRequest.java         # Request DTO
├── model/
│   ├── Message.java              # Message model
│   └── Event.java                # Event model
├── service/
│   ├── KafkaProducerService.java # Producer service
│   └── KafkaConsumerService.java # Consumer service
└── StreamApplication.java        # Main application
```

## Setup and Running

### 1. Start Kafka Infrastructure

Start Kafka, Zookeeper, Schema Registry, and Kafka UI using Docker Compose:

```bash
docker-compose up -d
```

This will start:
- Kafka broker on `localhost:9092`
- Zookeeper on `localhost:2181`
- Schema Registry on `localhost:8081`
- Kafka UI on `http://localhost:8090`

### 2. Build the Application

```bash
./mvnw clean install
```

### 3. Run the Application

```bash
./mvnw spring-boot:run
```

The application will start on `http://localhost:8080`

## Usage

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

## Monitoring

### Kafka UI

Access the Kafka UI at `http://localhost:8090` to:
- View topics and their configurations
- Browse messages
- Monitor consumer groups
- View broker information

### Application Logs

The application logs will show:
- Messages being sent to Kafka
- Messages being consumed from Kafka
- Partition and offset information

## Configuration

### Kafka Properties

The Kafka configuration is in `src/main/resources/application.properties`:

- `spring.kafka.bootstrap-servers`: Kafka broker address
- Producer settings: serializers, acks, retries
- Consumer settings: deserializers, group-id, offset reset

### Topics

Two topics are configured in `KafkaConfig.java`:
- `messages-topic`: For general messages
- `events-topic`: For domain events

Both topics have 3 partitions and replication factor of 1 (suitable for local development).

## Extending the Application

### Add Schema Registry Support

Uncomment the Schema Registry URL in `application.properties`:

```properties
spring.kafka.properties.schema.registry.url=http://localhost:8081
```

### Use Avro Serialization

1. Create Avro schema files in `src/main/resources/avro/`
2. Add Avro Maven plugin to `pom.xml`
3. Update serializers to use `KafkaAvroSerializer` and `KafkaAvroDeserializer`

### Add More Topics

Define new topics in `KafkaConfig.java`:

```java
@Bean
public NewTopic myNewTopic() {
    return TopicBuilder.name("my-new-topic")
            .partitions(3)
            .replicas(1)
            .build();
}
```

## Troubleshooting

### Kafka Connection Issues

If the application can't connect to Kafka:
1. Verify Kafka is running: `docker ps`
2. Check Kafka logs: `docker logs kafka`
3. Ensure port 9092 is not blocked

### Consumer Not Receiving Messages

1. Check consumer group in Kafka UI
2. Verify topic exists and has messages
3. Check consumer logs for deserialization errors

## Stopping the Infrastructure

```bash
docker-compose down
```

To remove volumes as well:

```bash
docker-compose down -v
```

## Additional Resources

- [Spring Kafka Documentation](https://spring.io/projects/spring-kafka)
- [Confluent Documentation](https://docs.confluent.io/)
- [Apache Kafka Documentation](https://kafka.apache.org/documentation/)
