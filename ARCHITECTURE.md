# OpenDrive Architecture & Deployment Guide

Complete technical documentation covering architecture, deployment modes, manual setup, and automated deployment scripts.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Component Details](#component-details)
3. [Deployment Modes](#deployment-modes)
4. [Event-Driven Architecture](#event-driven-architecture)
5. [Manual Deployment](#manual-deployment)
6. [Automated Deployment](#automated-deployment)
7. [Configuration Reference](#configuration-reference)
8. [How It All Works Together](#how-it-all-works-together)
9. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

OpenDrive implements a **modular monolith** pattern that can be deployed in two modes:

### Monolith Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Docker Network                      │
│                                                      │
│  ┌──────────────┐         ┌──────────────┐         │
│  │   Frontend   │────────▶│   Backend    │         │
│  │   (Next.js)  │  HTTP   │   (Node.js)  │         │
│  │              │         │              │         │
│  │  Port: 3000  │         │  Port: 5000  │         │
│  └──────────────┘         └───────┬──────┘         │
│                                   │                 │
│                            ┌──────▼───────┐        │
│                            │   MongoDB    │        │
│                            │   Port: 27017│        │
│                            └──────────────┘        │
│                                                     │
│  Backend Contains:                                 │
│  • API Routes (Express)                            │
│  • Business Logic                                  │
│  • Embedded Workers (same process):                │
│    - Thumbnail Generator                           │
│    - Search Indexer                                │
│  • In-Memory Event Bus (EventEmitter)              │
│                                                     │
└─────────────────────────────────────────────────────┘

Storage: Local filesystem or S3-compatible
Event Bus: Node.js EventEmitter (in-memory)
Complexity: Low
Users: <1K
Cost: $20/month
```

### Hybrid Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Docker Network                                 │
│                                                                       │
│  ┌──────────┐      ┌────────────────┐                               │
│  │ Frontend │──────▶│     Nginx      │  Load Balancer               │
│  │ Next.js  │ HTTP │  least_conn    │  Rate Limiting               │
│  │          │      │  Port: 80      │                               │
│  └──────────┘      └────────┬───────┘                               │
│                              │                                        │
│                     ┌────────┴─────────┐                             │
│                     │                  │                              │
│              ┌──────▼─────┐     ┌─────▼──────┐                      │
│              │   API-1    │     │   API-2    │  Stateless API       │
│              │ (Replica 1)│     │ (Replica 2)│  JWT Auth            │
│              │ Port: 5000 │     │ Port: 5000 │  No Workers          │
│              └──────┬─────┘     └─────┬──────┘                      │
│                     │                 │                              │
│                     └────────┬────────┘                              │
│                              │                                        │
│                  ┌───────────▼────────────┐                          │
│                  │  Confluent Cloud Kafka │  Managed Service         │
│                  │  (External - Cloud)    │  SASL_SSL Auth           │
│                  │  pkc-xxxxx.aws:9092    │  50GB Free Tier          │
│                  └───────────┬────────────┘                          │
│                              │                                        │
│                 ┌────────────┼────────────┐                          │
│                 │            │            │                           │
│          ┌──────▼─────┐  ┌──▼────────┐  ┌▼─────────┐               │
│          │ Thumbnail  │  │  Search   │  │ Promtail │               │
│          │  Worker    │  │  Worker   │  │ (Kafka → │               │
│          │            │  │           │  │  Loki)   │               │
│          └────────────┘  └───────────┘  └──┬───────┘               │
│                                             │                         │
│                                          ┌──▼────┐                   │
│                                          │ Loki  │  Log Storage      │
│                                          │ 7-day │                   │
│                                          └──┬────┘                   │
│                                             │                         │
│                                        ┌────▼────┐                   │
│                                        │ Grafana │  Visualization    │
│                                        │Port:3001│                   │
│                                        └─────────┘                   │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────┐       │
│  │                     MongoDB Container                     │       │
│  │                     Port: 27017                           │       │
│  └──────────────────────────────────────────────────────────┘       │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘

Storage: GCS (Google Cloud Storage) recommended
Event Bus: Kafka (Confluent Cloud)
Complexity: Medium
Users: 5K-10K
Cost: $40-60/month
```

---

## Component Details

### Frontend (Next.js 16)

**Purpose:** User interface for file management

**Technology Stack:**
- Next.js 16 (React framework)
- TypeScript
- Tailwind CSS
- Zustand (state management)

**Key Features:**
- Server-side rendering (SSR)
- File upload with drag-and-drop
- Folder management
- Public link sharing
- File previews

**Build Process:**
```bash
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
ARG NEXT_PUBLIC_API_URL=http://localhost:5000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN npm run build
CMD ["npm", "start"]
```

**Environment Variables:**
- `NEXT_PUBLIC_API_URL`: Backend API URL (baked at build time)
- `PORT`: Server port (default: 3000)

**Important:** The API URL is baked into the frontend at build time. For cloud deployments, you must rebuild the frontend with your backend's public URL.

---

### Backend (Node.js + Express)

**Purpose:** API server, business logic, authentication

**Technology Stack:**
- Node.js 18+
- Express.js
- Mongoose (MongoDB ODM)
- JWT authentication
- Multer (file uploads)

**Key Modules:**

#### 1. Application Entry (`app.js`)
```javascript
// Deployment mode detection
const deploymentMode = (process.env.DEPLOYMENT_MODE || 'monolith').toLowerCase();

if (deploymentMode !== 'microservices') {
    // MONOLITH: Load workers in same process
    require('./workers/thumbnail');
    require('./workers/searchIndexer');
} else {
    // HYBRID/MICROSERVICES: Skip workers
    logger.info('Workers run in separate containers');
}
```

**How this works:**
1. Checks `DEPLOYMENT_MODE` environment variable
2. If "microservices" → skips loading workers
3. Otherwise → loads workers into same process
4. Workers subscribe to EventBus events
5. Application code remains unchanged

#### 2. API Routes

| Route | Purpose | Authentication |
|-------|---------|----------------|
| `/api/auth/register` | User registration | Public |
| `/api/auth/login` | User login | Public |
| `/api/folders` | Folder CRUD | JWT required |
| `/api/files` | File upload/download | JWT required |
| `/api/files/:id/share` | Generate share links | JWT required |
| `/api/public/:token` | Access shared files | Token auth |
| `/api/search` | Search files | JWT required |
| `/api/health` | Health check | Public |

#### 3. Storage Abstraction (`storage/`)

```javascript
// storage/index.js
function getStorage() {
    const provider = process.env.STORAGE_PROVIDER || 'local';

    switch(provider) {
        case 'local':
            return new LocalStorage(process.env.STORAGE_PATH);
        case 's3':
        case 'minio':
            return new S3Storage({
                bucket: process.env.S3_BUCKET,
                region: process.env.S3_REGION,
                endpoint: process.env.S3_ENDPOINT,
                accessKey: process.env.S3_ACCESS_KEY,
                secretKey: process.env.S3_SECRET_KEY
            });
        case 'gcs':
            return new GCSStorage({
                projectId: process.env.GCS_PROJECT_ID,
                bucket: process.env.GCS_BUCKET,
                keyfile: process.env.GCS_KEYFILE
            });
        default:
            throw new Error(`Unknown storage provider: ${provider}`);
    }
}
```

**Storage Interface:**
```javascript
class StorageProvider {
    async upload(file, path) { }
    async download(path) { }
    async delete(path) { }
    async exists(path) { }
    getType() { }
}
```

#### 4. Middleware

| Middleware | Purpose | Location |
|------------|---------|----------|
| `authenticate.js` | JWT verification | All protected routes |
| `requestLogger.js` | Request/response logging | All routes |
| `errorHandler.js` | Error normalization | Global |

---

### Event Bus (`utils/eventBus.js`)

**Purpose:** Abstraction layer for event-driven architecture

This is the **CORE** of OpenDrive's architecture flexibility. It allows the same code to run in both deployment modes.

#### Architecture Pattern

```javascript
// Application code stays the same
const { getEventBus } = require('./utils/eventBus');
const eventBus = getEventBus();

// Publishing events
await eventBus.publish('file.uploaded', {
    fileId: '123',
    userId: 'abc',
    filename: 'photo.jpg'
});

// Subscribing to events
eventBus.subscribe('file.uploaded', async (data) => {
    // Process file (generate thumbnail, index for search, etc.)
});
```

#### Implementation: InMemoryEventBus (Monolith)

```javascript
class InMemoryEventBus {
    constructor() {
        this.emitter = new EventEmitter();
        this.emitter.setMaxListeners(100);
    }

    async publish(topic, data) {
        // Synchronous in-process event emission
        this.emitter.emit(topic, data);

        // Log event
        logger.debug('Event published (in-memory)', {
            component: 'eventbus',
            topic: topic
        });
    }

    subscribe(topic, handler) {
        // Register handler with EventEmitter
        this.emitter.on(topic, async (data) => {
            try {
                await handler(data);
            } catch (error) {
                logger.error('Event handler failed', {
                    topic: topic,
                    error: error.message
                });
            }
        });
    }
}
```

**How it works:**
1. Uses Node.js built-in `EventEmitter`
2. Events handled synchronously in same process
3. No network calls, instant execution
4. Perfect for single-server deployments

#### Implementation: KafkaEventBus (Hybrid)

```javascript
class KafkaEventBus {
    constructor() {
        const { Kafka } = require('kafkajs');

        // Parse brokers from environment
        const brokers = process.env.KAFKA_BROKERS.split(',');

        // Configure Kafka client
        const kafkaConfig = {
            clientId: process.env.KAFKA_CLIENT_ID || 'opendrive',
            brokers: brokers
        };

        // Add authentication for Confluent Cloud
        if (process.env.KAFKA_SASL_USERNAME && process.env.KAFKA_SASL_PASSWORD) {
            kafkaConfig.ssl = true;
            kafkaConfig.sasl = {
                mechanism: 'plain',
                username: process.env.KAFKA_SASL_USERNAME,
                password: process.env.KAFKA_SASL_PASSWORD
            };
        }

        this.kafka = new Kafka(kafkaConfig);
        this.producer = this.kafka.producer();
        this.consumers = new Map();
    }

    async connect() {
        await this.producer.connect();

        // Create admin client for topic management
        this.admin = this.kafka.admin();
        await this.admin.connect();

        // Auto-create topics if they don't exist
        await this.ensureTopicsExist([
            'file.uploaded',
            'file.deleted',
            'file.downloaded',
            'share.created',
            'share.revoked',
            'folder.created',
            'folder.deleted',
            'user.registered'
        ]);
    }

    async publish(topic, data) {
        await this.producer.send({
            topic: topic,
            messages: [{
                key: data.userId || null,
                value: JSON.stringify(data),
                headers: {
                    'correlation-id': uuidv4(),
                    'timestamp': Date.now().toString()
                }
            }]
        });
    }

    subscribe(topic, handler) {
        const groupId = `${process.env.KAFKA_CLIENT_ID}-${topic}`;
        const consumer = this.kafka.consumer({ groupId });

        consumer.connect().then(() => {
            consumer.subscribe({ topic, fromBeginning: false });

            consumer.run({
                eachMessage: async ({ topic, partition, message }) => {
                    const data = JSON.parse(message.value.toString());
                    await handler(data);
                }
            });
        });

        this.consumers.set(topic, consumer);
    }
}
```

**How it works:**
1. Uses `kafkajs` library to connect to Kafka
2. Supports both self-hosted and Confluent Cloud Kafka
3. Auto-creates topics if they don't exist
4. Messages distributed across partitions
5. Consumer groups ensure each message processed once

#### Factory Function

```javascript
let eventBusInstance = null;

function getEventBus() {
    if (eventBusInstance) {
        return eventBusInstance;
    }

    const deploymentMode = (process.env.DEPLOYMENT_MODE || 'monolith').toLowerCase();

    if (deploymentMode === 'microservices') {
        eventBusInstance = new KafkaEventBus();
        eventBusInstance.connect();
    } else {
        eventBusInstance = new InMemoryEventBus();
    }

    return eventBusInstance;
}

module.exports = { getEventBus };
```

**Decision Logic:**
- `DEPLOYMENT_MODE=microservices` → KafkaEventBus
- `DEPLOYMENT_MODE=monolith` or not set → InMemoryEventBus
- Singleton pattern ensures one instance per process

---

### Workers

Workers process background tasks triggered by events.

#### Monolith Workers (`workers/thumbnail.js`, `workers/searchIndexer.js`)

**Loaded by:** `app.js` when `DEPLOYMENT_MODE !== 'microservices'`

**Example: Thumbnail Worker**
```javascript
// workers/thumbnail.js
const { getEventBus } = require('../utils/eventBus');
const sharp = require('sharp');
const File = require('../models/File');
const { getStorage } = require('../storage');

const eventBus = getEventBus();
const storage = getStorage();

// Subscribe to file.uploaded events
eventBus.subscribe('file.uploaded', async (data) => {
    const { fileId, userId } = data;

    try {
        // Fetch file metadata
        const file = await File.findById(fileId);

        if (!file || !file.mimetype.startsWith('image/')) {
            return; // Skip non-images
        }

        // Download original file
        const originalBuffer = await storage.download(file.path);

        // Generate thumbnail (200x200)
        const thumbnailBuffer = await sharp(originalBuffer)
            .resize(200, 200, { fit: 'cover' })
            .jpeg({ quality: 80 })
            .toBuffer();

        // Upload thumbnail
        const thumbnailPath = `thumbnails/${fileId}.jpg`;
        await storage.upload(thumbnailBuffer, thumbnailPath);

        // Update database
        file.thumbnail = thumbnailPath;
        await file.save();

        logger.info('Thumbnail generated', {
            component: 'thumbnail-worker',
            fileId: fileId
        });

    } catch (error) {
        logger.error('Thumbnail generation failed', {
            component: 'thumbnail-worker',
            fileId: fileId,
            error: error.message
        });
    }
});

logger.info('Thumbnail worker initialized (embedded mode)');
```

**How it works:**
1. Worker file is `require()`d by `app.js`
2. Subscription code executes immediately
3. EventBus registers the handler
4. When event published, handler executes in same process
5. No network latency, instant processing

#### Hybrid Workers (`workers/thumbnail-standalone.js`, `workers/searchIndexer-standalone.js`)

**Run as:** Separate Docker containers

**Example: Standalone Thumbnail Worker**
```javascript
// workers/thumbnail-standalone.js
const mongoose = require('mongoose');
const { getEventBus } = require('../utils/eventBus');

// Set deployment mode to use Kafka
process.env.DEPLOYMENT_MODE = 'microservices';

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI);

// Get Kafka-based EventBus
const eventBus = getEventBus();

// Load the worker logic (same as embedded version)
require('./thumbnail');

logger.info('Standalone thumbnail worker started', {
    component: 'thumbnail-worker',
    mode: 'standalone',
    kafkaBrokers: process.env.KAFKA_BROKERS
});

// Keep process alive
process.on('SIGTERM', async () => {
    await eventBus.close();
    await mongoose.disconnect();
    process.exit(0);
});
```

**How it works:**
1. Forces `DEPLOYMENT_MODE=microservices`
2. EventBus returns KafkaEventBus instance
3. Connects to Confluent Cloud Kafka
4. Subscribes to `file.uploaded` topic
5. Processes messages from Kafka queue
6. Multiple workers can run in parallel (consumer groups)

**Docker Compose Entry:**
```yaml
thumbnail-worker:
  build: ./backend
  command: node workers/thumbnail-standalone.js
  environment:
    DEPLOYMENT_MODE: microservices
    KAFKA_ENABLED: "true"
    KAFKA_BROKERS: ${KAFKA_BOOTSTRAP_SERVERS}
    KAFKA_SASL_USERNAME: ${KAFKA_API_KEY}
    KAFKA_SASL_PASSWORD: ${KAFKA_API_SECRET}
    MONGODB_URI: mongodb://admin:password@mongodb:27017/opendrive
```

---

### MongoDB

**Purpose:** Metadata storage

**Collections:**

| Collection | Purpose | Indexes |
|------------|---------|---------|
| `users` | User accounts | email (unique) |
| `folders` | Folder hierarchy | userId, parentId |
| `files` | File metadata | userId, folderId, name |
| `shares` | Public share links | token (unique), fileId |

**Schema: File**
```javascript
{
  _id: ObjectId,
  name: String,
  mimetype: String,
  size: Number,
  path: String,           // Storage path (local or GCS)
  thumbnail: String,      // Generated by worker
  userId: ObjectId,       // Owner
  folderId: ObjectId,     // Parent folder (null = root)
  searchIndexed: Boolean, // Indexed by worker
  createdAt: Date,
  updatedAt: Date
}
```

**Connection:**
- Monolith: `mongodb://mongodb:27017/opendrive`
- Hybrid: Same (MongoDB runs as container)

---

### Confluent Cloud Kafka (Hybrid Only)

**Purpose:** Event streaming and centralized logging

**Topics:**

| Topic | Partitions | Retention | Purpose |
|-------|------------|-----------|---------|
| `file.uploaded` | 6 | 7 days | Trigger thumbnail generation |
| `file.deleted` | 3 | 7 days | Cleanup resources |
| `file.downloaded` | 3 | 7 days | Analytics |
| `share.created` | 3 | 7 days | Audit trail |
| `share.revoked` | 3 | 7 days | Audit trail |
| `folder.created` | 3 | 7 days | Audit trail |
| `folder.deleted` | 3 | 7 days | Cleanup resources |
| `user.registered` | 1 | 7 days | Onboarding triggers |
| `opendrive-logs-critical` | 3 | 30 days | ERROR/WARN logs |
| `opendrive-logs-info` | 3 | 7 days | INFO logs |
| `opendrive-logs-debug` | 3 | 1 day | DEBUG logs |

**Authentication:**
```bash
# Environment variables
KAFKA_BROKERS=pkc-xxxxx.us-east-1.aws.confluent.cloud:9092
KAFKA_SASL_USERNAME=ABC123DEF456
KAFKA_SASL_PASSWORD=xYz789...
```

**Connection Config:**
```javascript
{
    brokers: ['pkc-xxxxx.us-east-1.aws.confluent.cloud:9092'],
    ssl: true,
    sasl: {
        mechanism: 'plain',
        username: 'ABC123DEF456',
        password: 'xYz789...'
    }
}
```

---

### Logging Stack (Hybrid Only)

#### Promtail

**Purpose:** Scrape logs from Kafka and send to Loki

**Configuration (`config/promtail.yml`):**
```yaml
server:
  http_listen_port: 9080
  grpc_listen_port: 0

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: kafka-logs-critical
    kafka:
      brokers:
        - ${KAFKA_BROKERS}
      topics: ["opendrive-logs-critical"]
      group_id: promtail-critical
      use_incoming_timestamp: true
      version: 2.8.0
      authentication:
        type: sasl
        sasl_config:
          mechanism: PLAIN
          user: ${KAFKA_API_KEY}
          password: ${KAFKA_API_SECRET}
          use_tls: true
    relabel_configs:
      - source_labels: [__meta_kafka_topic]
        target_label: topic
```

**How it works:**
1. Promtail connects to Confluent Cloud Kafka as consumer
2. Subscribes to three log topics (critical, info, debug)
3. Reads log messages from Kafka
4. Forwards to Loki for storage
5. Adds labels for querying (topic, partition, etc.)

#### Loki

**Purpose:** Log aggregation and storage

**Configuration:**
- Default config (no customization needed)
- Storage: `/loki` directory (Docker volume)
- Retention: 7 days
- Port: 3100

#### Grafana

**Purpose:** Log visualization and querying

**Pre-configured Datasource (`config/grafana-datasources.yml`):**
```yaml
apiVersion: 1
datasources:
  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    isDefault: true
```

**Example Queries:**
```
# All error logs
{topic="opendrive-logs-critical"}

# File uploads
{topic="opendrive-logs-info"} |= "file uploaded"

# API logs only
{topic=~".+"} | json | SERVICE_NAME="api"

# Last 5 minutes
{topic=~".+"} |= "error" [5m]
```

---

### Nginx Load Balancer (Hybrid Only)

**Purpose:** Distribute traffic across API replicas

**Configuration (`config/nginx.conf`):**
```nginx
upstream backend {
    least_conn;  # Route to server with fewest connections
    server api:5000 max_fails=3 fail_timeout=30s;
}

# Rate limiting
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=50r/s;
limit_req_zone $binary_remote_addr zone=upload_limit:10m rate=5r/s;

server {
    listen 80;
    client_max_body_size 100M;

    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /api/files {
        limit_req zone=upload_limit burst=10 nodelay;
        proxy_pass http://backend;
        proxy_request_buffering off;
    }
}
```

**Features:**
- Load balancing with `least_conn` algorithm
- Health checks (automatic failover)
- Rate limiting (DDoS protection)
- Request buffering disabled for uploads
- Connection pooling

---

## Deployment Modes

### Mode Comparison

| Aspect | Monolith | Hybrid |
|--------|----------|--------|
| **Deployment Mode** | `monolith` (default) | `microservices` |
| **Containers** | 3 | 8 |
| **Event Bus** | EventEmitter | Kafka |
| **Workers** | Embedded | Standalone |
| **Kafka Required** | No | Yes (Confluent Cloud) |
| **Load Balancer** | No | Yes (Nginx) |
| **Logging** | Console | Centralized (Grafana) |
| **API Replicas** | 1 | 2+ |
| **Scalability** | Vertical only | Horizontal + Vertical |
| **Complexity** | Low | Medium |
| **Setup Time** | 2 minutes | 5-10 minutes |
| **Max Users** | ~1K | 5K-10K |
| **Monthly Cost** | $20 | $40-60 |

### Choosing a Mode

**Use Monolith if:**
- Personal use or small team (<10 users)
- Limited budget ($20/month VPS)
- Simple deployment preferred
- Low traffic (<1K requests/day)
- Learning/development environment

**Use Hybrid if:**
- Production deployment
- Growing user base (100-10K users)
- Need observability (logs, metrics)
- Want to scale horizontally
- Can afford $40-60/month
- Need high availability

---

## Event-Driven Architecture

### Event Flow: File Upload

#### Monolith Mode

```
User uploads file
    ↓
1. POST /api/files
    ↓
2. Express route handler
    ↓
3. Save file to storage (local/GCS)
    ↓
4. Create File document in MongoDB
    ↓
5. eventBus.publish('file.uploaded', { fileId, userId })
    ↓
6. EventEmitter.emit() - SYNCHRONOUS
    ↓
    ├─→ Thumbnail worker (same process)
    │   ├─ Download file
    │   ├─ Generate thumbnail
    │   └─ Update File.thumbnail
    │
    └─→ Search indexer (same process)
        ├─ Extract text content
        ├─ Index in MongoDB
        └─ Update File.searchIndexed
    ↓
7. Return 200 OK to user
    ↓
User sees uploaded file immediately
(Thumbnail may take 1-2 seconds)
```

#### Hybrid Mode

```
User uploads file
    ↓
1. POST /api/files → Nginx
    ↓
2. Nginx routes to API-1 or API-2 (least_conn)
    ↓
3. Express route handler (API-1)
    ↓
4. Save file to GCS
    ↓
5. Create File document in MongoDB
    ↓
6. eventBus.publish('file.uploaded', { fileId, userId })
    ↓
7. Kafka producer sends message to Confluent Cloud
    ↓
8. Return 200 OK to user (async processing)
    ↓
User sees uploaded file immediately

[ASYNC - Separate containers]
    ↓
9. Kafka delivers message to consumers
    ↓
    ├─→ Thumbnail worker container
    │   ├─ Receives message from Kafka
    │   ├─ Downloads file from GCS
    │   ├─ Generates thumbnail with Sharp
    │   ├─ Uploads thumbnail to GCS
    │   └─ Updates File.thumbnail in MongoDB
    │
    ├─→ Search indexer container
    │   ├─ Receives SAME message from Kafka
    │   ├─ Downloads file from GCS
    │   ├─ Extracts text content
    │   ├─ Creates search index in MongoDB
    │   └─ Updates File.searchIndexed
    │
    └─→ Promtail (for logging)
        └─ Scrapes logs from Kafka → Loki → Grafana
```

### Event Topics

| Event | Publisher | Consumers | Purpose |
|-------|-----------|-----------|---------|
| `file.uploaded` | API server | Thumbnail worker, Search indexer | Process new file |
| `file.deleted` | API server | Cleanup worker | Remove from storage |
| `file.downloaded` | API server | Analytics worker | Track downloads |
| `share.created` | API server | Audit logger | Log sharing activity |
| `share.revoked` | API server | Audit logger | Log revocation |
| `folder.created` | API server | Search indexer | Index folder |
| `folder.deleted` | API server | Cleanup worker | Remove contents |
| `user.registered` | Auth service | Onboarding worker | Welcome email, setup |

---

## Manual Deployment

### Monolith Deployment (Manual)

#### Prerequisites
```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

#### Step 1: Clone Repository
```bash
git clone https://github.com/roguezox/storage-system.git
cd storage-system
```

#### Step 2: Create Environment File
```bash
cp .env.example .env
```

#### Step 3: Generate Secrets
```bash
# Generate JWT secret (32 bytes = 64 hex chars)
JWT_SECRET=$(openssl rand -hex 32)

# Generate MongoDB password (24 bytes, alphanumeric only)
MONGO_PASSWORD=$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-25)

# Append to .env
echo "JWT_SECRET=$JWT_SECRET" >> .env
echo "MONGO_PASSWORD=$MONGO_PASSWORD" >> .env
```

#### Step 4: Configure Environment
Edit `.env`:
```bash
# Security (auto-generated above)
JWT_SECRET=your-generated-secret-here
MONGO_PASSWORD=your-generated-password-here

# MongoDB connection (Docker service name)
MONGO_USERNAME=admin

# Storage (choose one)
STORAGE_PROVIDER=local  # or 's3' or 'gcs'

# For local storage (default)
STORAGE_PATH=/app/uploads

# Application URLs
API_URL=http://localhost:5000

# Docker Hub (for pre-built images)
DOCKERHUB_USERNAME=roguezoxx
TAG=latest
```

#### Step 5: Start Services
```bash
# Build and start all containers
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

#### Step 6: Verify Health
```bash
# Check MongoDB
docker exec -it opendrive-db mongosh --eval "db.runCommand('ping')"

# Check Backend API
curl http://localhost:5000/api/health
# Expected: {"status":"ok","message":"Storage Platform API is running","mongodb":"connected"}

# Check Frontend
curl http://localhost:3000
# Expected: HTML response
```

#### Step 7: Create First User
```bash
# Open browser
open http://localhost:3000

# Click "Register"
# Enter email and password
# Start uploading files!
```

---

### Hybrid Deployment (Manual)

See [HYBRID-DEPLOYMENT.md](HYBRID-DEPLOYMENT.md) for complete manual deployment guide including:
- Confluent Cloud setup (11 topics)
- GCS configuration
- Container orchestration
- Health verification
- Scaling procedures

**Quick summary:**
1. Sign up for Confluent Cloud (free tier)
2. Create Kafka cluster and 11 topics
3. Get API key/secret and bootstrap server URL
4. Configure `.env` with Confluent credentials
5. Optionally setup GCS for file storage
6. Run `docker-compose -f docker-compose.hybrid.yml up -d`
7. Verify all 8 containers are running
8. Access Grafana at http://localhost:3001 for logs

---

## Automated Deployment

### Monolith: Using Docker Compose

**File: `docker-compose.yml`**

This file automates the entire monolith deployment.

**What it does:**
1. Defines 3 services (mongodb, backend, frontend)
2. Creates Docker network for inter-container communication
3. Sets up persistent volumes for data
4. Configures health checks
5. Establishes dependency order (mongodb → backend → frontend)

**Usage:**
```bash
# Start all services
docker-compose up -d

# Equivalent to:
# 1. docker network create opendrive-net
# 2. docker volume create mongodb_data
# 3. docker volume create uploads_data
# 4. docker run mongo:7 ...
# 5. docker run opendrive-backend ...
# 6. docker run opendrive-frontend ...
```

---

### Hybrid: Using setup-hybrid.sh

**File: `setup-hybrid.sh`**

Automated setup script that handles:
1. Prerequisite checks
2. Secret generation
3. User configuration
4. Docker image pulling
5. Service startup
6. Health verification

**Script Phases:**

#### Phase 1: Prerequisites Check
```bash
#!/bin/bash
set -e  # Exit on any error

# Check Docker installed
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed"
    echo "Install: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "Error: Docker Compose is not installed"
    exit 1
fi
```

#### Phase 2: Environment Configuration
```bash
if [ ! -f .env ]; then
    # Generate secrets
    JWT_SECRET=$(openssl rand -hex 32)
    MONGO_PASSWORD=$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-25)

    # Create .env with template
    cat > .env << EOF
JWT_SECRET=$JWT_SECRET
MONGO_PASSWORD=$MONGO_PASSWORD
GRAFANA_PASSWORD=admin

KAFKA_BOOTSTRAP_SERVERS=pkc-xxxxx.aws:9092
KAFKA_API_KEY=your-key
KAFKA_API_SECRET=your-secret

STORAGE_PROVIDER=local
EOF

    # Prompt user to configure Confluent
    echo "Configure Confluent Cloud credentials in .env"
    read -p "Press Enter after configuring..."
fi
```

#### Phase 3: Storage Setup
```bash
mkdir -p uploads
chmod 777 uploads  # Docker write access
```

#### Phase 4: Pull Images
```bash
docker-compose -f docker-compose.hybrid.yml pull --quiet
```

#### Phase 5: Start Services
```bash
docker-compose -f docker-compose.hybrid.yml up -d
```

#### Phase 6: Health Verification
```bash
sleep 15  # Wait for initialization

# Test backend
if curl -sf http://localhost/health > /dev/null; then
    echo "Backend: OK"
else
    echo "Backend: Starting..."
fi

# Test frontend
if curl -sf http://localhost:3000 > /dev/null; then
    echo "Frontend: OK"
fi
```

#### Phase 7: Summary
```bash
echo "Setup Complete!"
echo "Frontend:  http://localhost:3000"
echo "API:       http://localhost/api"
echo "Grafana:   http://localhost:3001"
```

**Time Savings:**
- Manual: 30-45 minutes
- Automated: 5-10 minutes

---

## Configuration Reference

### Environment Variables

#### Global Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `production` | Environment mode |
| `PORT` | No | `5000` | Backend server port |
| `JWT_SECRET` | Yes | - | JWT signing secret (min 32 chars) |
| `MONGODB_URI` | Yes | - | MongoDB connection string |
| `LOG_LEVEL` | No | `info` | Logging level |

#### Deployment Mode

| Variable | Values | Default | Description |
|----------|--------|---------|-------------|
| `DEPLOYMENT_MODE` | `monolith`, `microservices` | `monolith` | Event bus and worker mode |

#### Storage Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STORAGE_PROVIDER` | Yes | `local` | Storage backend |
| `STORAGE_PATH` | No | `./uploads` | Local directory path |

**For GCS:**
| Variable | Required | Description |
|----------|----------|-------------|
| `GCS_PROJECT_ID` | Yes | Google Cloud project ID |
| `GCS_BUCKET` | Yes | GCS bucket name |
| `GCS_KEYFILE` | Yes | Path to service account key |

#### Kafka Configuration (Hybrid Only)

| Variable | Required | Description |
|----------|----------|-------------|
| `KAFKA_ENABLED` | No | Enable Kafka logging |
| `KAFKA_BROKERS` | Yes* | Broker addresses |
| `KAFKA_CLIENT_ID` | No | Client identifier |
| `KAFKA_SASL_USERNAME` | No** | Confluent API key |
| `KAFKA_SASL_PASSWORD` | No** | Confluent API secret |

*Required if `DEPLOYMENT_MODE=microservices`
**Required for Confluent Cloud

---

## How It All Works Together

For a detailed walkthrough of a complete file upload request through the hybrid architecture, including:
- User request → Nginx load balancer
- API processing and storage
- Kafka event publishing
- Worker consumption and processing
- Logging pipeline (Kafka → Promtail → Loki → Grafana)
- Frontend updates

See the "Request Flow: File Upload (Hybrid Mode)" section in the original comprehensive version or [HYBRID-DEPLOYMENT.md](HYBRID-DEPLOYMENT.md).

---

## Troubleshooting

### Common Issues

#### 1. MongoDB Connection Failed
```
MongooseServerSelectionError: connect ECONNREFUSED
```

**Solutions:**
- Use service name: `mongodb://mongodb:27017` (not localhost)
- Check health: `docker ps | grep mongodb`
- View logs: `docker logs mongodb`

#### 2. Kafka Connection Failed
```
KafkaJSConnectionError: Failed to connect
```

**Solutions:**
- Verify Confluent credentials in `.env`
- Check bootstrap server URL
- Ensure topics created in Confluent Cloud
- Firewall allows port 9092

#### 3. Workers Not Processing
- Check `DEPLOYMENT_MODE=microservices` set
- Verify worker logs: `docker-compose logs thumbnail-worker`
- Check Kafka consumer groups in Confluent dashboard

#### 4. File Upload 413 Error
- Increase Nginx: `client_max_body_size 100M`
- Increase Express: `express.json({ limit: '100mb' })`

#### 5. Frontend Can't Connect
- Verify `NEXT_PUBLIC_API_URL` matches backend
- Rebuild frontend with correct API URL for cloud deployments
- Check CORS settings

---

## Additional Resources

- [QUICKSTART-HYBRID.md](QUICKSTART-HYBRID.md) - Quick start guide
- [HYBRID-DEPLOYMENT.md](HYBRID-DEPLOYMENT.md) - Production deployment
- [CONFLUENT-CLOUD-SETUP.md](CONFLUENT-CLOUD-SETUP.md) - Kafka setup
- [README.md](README.md) - General overview

---

<div align="center">

Made with care for developers who value ownership

[GitHub](https://github.com/roguezox/storage-system)

</div>
