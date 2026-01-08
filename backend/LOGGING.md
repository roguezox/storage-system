# Logging Implementation Guide

This document describes the comprehensive logging system implemented in the storage-system backend, which sends structured logs to Confluent Cloud Kafka.

## Overview

The logging system captures **54 different log events** across all operations, sending them to Kafka topics in Confluent Cloud for centralized log aggregation, monitoring, and analytics.

## Architecture

```
Application Code
      ↓
Winston Logger (utils/logger.js)
      ↓
KafkaJS Producer (Custom Transport)
      ↓
Confluent Cloud Kafka
      ↓
Log Topics (critical, info, debug)
```

## Log Topics

Logs are automatically routed to different Kafka topics based on severity:

| Topic | Log Levels | Retention | Use Case |
|-------|------------|-----------|----------|
| `storage-system-logs-critical` | ERROR, WARN | 30 days | Alerts, security events, failures |
| `storage-system-logs-info` | INFO | 7 days | Business events, user activity |
| `storage-system-logs-debug` | DEBUG | 1 day | Storage operations, performance data |

## Log Structure

All logs are sent as structured JSON with the following fields:

```json
{
  "timestamp": "2026-01-07T10:15:30.123Z",
  "level": "info",
  "component": "files",
  "operation": "upload",
  "userId": "507f1f77bcf86cd799439011",
  "requestId": "uuid-request-id",
  "duration": 1247,
  "metadata": {},
  "service": "storage-system-backend",
  "environment": "production"
}
```

## Components and Operations

### 1. Application Lifecycle (4 logs)
- **Database Connection**: Success/failure with MongoDB
- **Server Startup**: Port, environment, storage provider
- **Storage Provider Init**: Configuration details

### 2. Authentication (8 logs)
- **User Registration**: Success, duplicate user, errors
- **User Login**: Success, invalid credentials (wrong password/user not found), errors
- **Token Verification**: Invalid token, user not found

### 3. File Operations (17 logs)
- **Upload**: Individual file success/failure, batch summary
- **Download**: Success, not found, errors
- **Rename**: File renamed
- **Delete**: Soft delete, permanent delete, storage deletion failures
- **Sharing**: Share link generated/revoked
- **Trash**: File restored, trash emptied

### 4. Folder Operations (9 logs)
- **Create**: Folder created, creation errors
- **Rename**: Folder renamed
- **Delete**: Soft delete (cascade), permanent delete (cascade)
- **Sharing**: Share link generated
- **Restore**: Folder restored (cascade)

### 5. Public Access (4 logs)
- **Folder Access**: Public folder viewed
- **File Access**: Public file viewed/downloaded
- **Access Denied**: Unauthorized access attempts
- **Download Errors**: Failed downloads

### 6. Search (2 logs)
- **Search Success**: Query, results count
- **Search Errors**: Failed searches

### 7. Storage Providers (6 logs)
- **Local Storage**: Upload, download, delete (DEBUG level)
- **S3 Storage**: Upload, download, delete (DEBUG level)

### 8. HTTP Middleware (1 log per request)
- **All HTTP Requests**: Method, path, status, duration, user

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Enable Kafka logging
KAFKA_ENABLED=true

# Confluent Cloud connection
KAFKA_BOOTSTRAP_SERVERS=pkc-xxxxx.confluent.cloud:9092
KAFKA_API_KEY=your-api-key
KAFKA_API_SECRET=your-api-secret

# Topic configuration
KAFKA_TOPIC=storage-system-logs

# Log level (error, warn, info, debug)
LOG_LEVEL=info
```

### Disable Kafka Logging

To disable Kafka and only log to console:

```bash
KAFKA_ENABLED=false
```

Or simply don't set the Kafka environment variables.

## Deployment to Cloud Run

### 1. Install Dependencies

```bash
cd storage-system/backend
npm install
```

### 2. Build Docker Image

```bash
docker build -t gcr.io/YOUR_PROJECT/opendrive-backend:v2 .
docker push gcr.io/YOUR_PROJECT/opendrive-backend:v2
```

### 3. Deploy to Cloud Run with Kafka Config

```bash
gcloud run deploy opendrive-backend \
  --image=gcr.io/YOUR_PROJECT/opendrive-backend:v2 \
  --platform=managed \
  --region=us-central1 \
  --set-env-vars="KAFKA_ENABLED=true" \
  --set-env-vars="KAFKA_BOOTSTRAP_SERVERS=pkc-xxxxx.confluent.cloud:9092" \
  --set-env-vars="KAFKA_API_KEY=your-key" \
  --set-env-vars="KAFKA_API_SECRET=your-secret" \
  --set-env-vars="KAFKA_TOPIC=storage-system-logs" \
  --set-env-vars="LOG_LEVEL=info" \
  --set-env-vars="MONGODB_URI=your-mongodb-uri" \
  --set-env-vars="JWT_SECRET=your-jwt-secret" \
  --allow-unauthenticated
```

### 4. Verify Logs

After deployment, logs will flow to Confluent Cloud automatically. You can verify by:

1. Checking Confluent Cloud console for incoming messages
2. Using `gcloud run logs read opendrive-backend` to see console output
3. Testing API endpoints and observing Kafka topics

## Kafka Topic Setup

Create these topics in Confluent Cloud:

```bash
# Critical logs
Topic: storage-system-logs-critical
Partitions: 3
Retention: 30 days

# Info logs
Topic: storage-system-logs-info
Partitions: 6
Retention: 7 days

# Debug logs
Topic: storage-system-logs-debug
Partitions: 3
Retention: 1 day
```

## Monitoring and Alerts

### Key Metrics to Track

1. **Authentication Failures**: Monitor `WARN` logs with `operation: login` for brute force attacks
2. **Upload Failures**: Track `ERROR` logs with `operation: upload` for storage issues
3. **API Response Times**: Monitor `duration` field in HTTP middleware logs
4. **Storage Provider Errors**: Watch `ERROR` logs from storage components

### Sample Alert Rules

**High Authentication Failure Rate**:
```
component = "auth"
AND level = "warn"
AND operation = "login"
COUNT > 10 in 5 minutes
```

**Slow API Responses**:
```
component = "http"
AND duration > 5000
COUNT > 5 in 1 minute
```

**Storage Upload Failures**:
```
component = "files"
AND level = "error"
AND operation = "upload"
COUNT > 3 in 5 minutes
```

## Log Examples

### Successful File Upload

```json
{
  "timestamp": "2026-01-07T10:15:30.123Z",
  "level": "info",
  "component": "files",
  "operation": "upload",
  "userId": "507f1f77bcf86cd799439011",
  "folderId": "65a1b2c3d4e5f6789",
  "fileId": "65a1b2c3d4e5f6790",
  "fileName": "document.pdf",
  "fileSize": 1048576,
  "mimeType": "application/pdf",
  "storageProvider": "s3",
  "storageKey": "507f.../2026/01/07/uuid-document.pdf",
  "duration": 1247,
  "service": "storage-system-backend",
  "environment": "production"
}
```

### Failed Login Attempt

```json
{
  "timestamp": "2026-01-07T10:16:45.456Z",
  "level": "warn",
  "component": "auth",
  "operation": "login",
  "email": "user@example.com",
  "ipAddress": "203.0.113.42",
  "reason": "wrong_password",
  "service": "storage-system-backend",
  "environment": "production"
}
```

### HTTP Request

```json
{
  "timestamp": "2026-01-07T10:17:12.789Z",
  "level": "info",
  "component": "http",
  "operation": "request",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "method": "POST",
  "path": "/api/files",
  "statusCode": 201,
  "duration": 1247,
  "userId": "507f1f77bcf86cd799439011",
  "ipAddress": "203.0.113.42",
  "userAgent": "Mozilla/5.0...",
  "contentLength": 1048576,
  "service": "storage-system-backend",
  "environment": "production"
}
```

## Performance Considerations

- **Kafka Producer**: Uses connection pooling and batching for efficiency
- **Message Queue**: Logs are queued during Kafka connection establishment
- **Graceful Shutdown**: Producer disconnects cleanly on SIGINT/SIGTERM
- **Non-blocking**: Logging doesn't block API responses

## Troubleshooting

### Kafka Connection Issues

If logs aren't reaching Confluent Cloud:

1. **Check Environment Variables**: Ensure all Kafka variables are set
2. **Verify Credentials**: Test with Confluent Cloud CLI
3. **Check Network**: Ensure Cloud Run can reach Confluent Cloud (no firewall blocking)
4. **Review Console Logs**: Look for "Kafka producer connected" message

### High Log Volume

If log volume is too high:

1. **Increase LOG_LEVEL**: Change from `debug` to `info` or `warn`
2. **Adjust Retention**: Reduce retention periods in Confluent Cloud
3. **Filter Debug Logs**: Debug logs (storage operations) are high volume

### Missing Logs

If some logs are missing:

1. **Check Log Level**: `LOG_LEVEL=debug` captures all logs
2. **Verify Topics**: Ensure all three topics exist in Confluent Cloud
3. **Review Partitions**: More partitions improve throughput

## Future Enhancements

- **Distributed Tracing**: Add trace IDs for request correlation
- **Log Sampling**: Reduce DEBUG log volume with sampling
- **Schema Registry**: Use Avro for schema evolution
- **Dead Letter Queue**: Handle failed log deliveries
- **Metrics Export**: Export metrics to Prometheus/Grafana

## Support

For issues or questions:
- Check Confluent Cloud console for topic health
- Review Cloud Run logs: `gcloud run logs read opendrive-backend`
- Monitor Kafka producer errors in application logs
