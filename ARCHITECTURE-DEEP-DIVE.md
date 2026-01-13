# OpenDrive Architecture Deep Dive

**Complete Technical Documentation of All 4 Deployment Architectures**

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture 1: Monolith (Docker Compose)](#architecture-1-monolith-docker-compose)
3. [Architecture 2: Docker + Kafka (VM)](#architecture-2-docker--kafka-vm)
4. [Architecture 3: Serverless (Cloud Run)](#architecture-3-serverless-cloud-run)
5. [Architecture 4: Kubernetes (GKE)](#architecture-4-kubernetes-gke)
6. [Core Components Deep Dive](#core-components-deep-dive)
7. [Event Bus Architecture](#event-bus-architecture)
8. [Storage Abstraction Layer](#storage-abstraction-layer)
9. [Logging & Monitoring](#logging--monitoring)
10. [Configuration Management](#configuration-management)
11. [Migration Guide](#migration-guide)

---

## System Overview

OpenDrive is a cloud storage system with **deployment mode awareness** built into the codebase. The application intelligently adapts its behavior based on the `DEPLOYMENT_MODE` environment variable.

### Core Services

| Service | Description | Runs In |
|---------|-------------|---------|
| **API Server** | REST API for file/folder operations | All architectures |
| **Thumbnail Worker** | Generates image thumbnails | Monolith (embedded) or Standalone |
| **Search Indexer** | Indexes files for search | Monolith (embedded) or Standalone |
| **Frontend** | Next.js web application | All architectures |
| **MongoDB** | Document database | Embedded (Docker) or Atlas (Cloud) |
| **Event Bus** | Message passing between services | In-Memory or Kafka |
| **Log Service** | Kafka → Loki log aggregation | Microservices only |
| **Grafana** | Log visualization | Microservices only |

### Deployment Mode Detection

```javascript
// backend/app.js:187-189
const deploymentMode = (process.env.DEPLOYMENT_MODE || 'monolith').toLowerCase();

if (deploymentMode !== 'microservices') {
    // MONOLITH MODE: Load workers in same process
    require('./workers/thumbnail');
    require('./workers/searchIndexer');
} else {
    // MICROSERVICES MODE: Workers run as separate containers
    console.log('Running in microservices mode - workers are external');
}
```

**Key Insight:** The same codebase supports all 4 architectures through conditional logic and environment-based configuration.

---

## Architecture 1: Monolith (Docker Compose)

### Overview
Single-server deployment where all components run in one process or as tightly coupled Docker containers.

### Architecture Diagram
```
┌─────────────────────────────────────────────┐
│         Docker Compose (Single Host)        │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │   Backend Container (Node.js)       │   │
│  │   Port: 5000                        │   │
│  │                                     │   │
│  │   ├─── API Routes                  │   │
│  │   │    ├─ /api/auth                │   │
│  │   │    ├─ /api/files               │   │
│  │   │    ├─ /api/folders             │   │
│  │   │    └─ /api/search              │   │
│  │   │                                 │   │
│  │   ├─── Embedded Workers (same PID) │   │
│  │   │    ├─ Thumbnail Generator      │   │
│  │   │    └─ Search Indexer           │   │
│  │   │                                 │   │
│  │   └─── In-Memory Event Bus         │   │
│  │        (Node.js EventEmitter)      │   │
│  └─────────────────────────────────────┘   │
│                 ▲                           │
│                 │                           │
│  ┌──────────────┴──────────────────────┐   │
│  │   Frontend Container (Next.js)      │   │
│  │   Port: 3000                        │   │
│  │   - Server-side rendering           │   │
│  │   - API proxy to backend            │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │   MongoDB Container                 │   │
│  │   Port: 27017                       │   │
│  │   - Document storage                │   │
│  │   - File metadata                   │   │
│  │   - User authentication             │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │   Docker Volumes (Persistent)       │   │
│  │   - mongodb_data/                   │   │
│  │   - uploads_data/                   │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### How It Works

#### 1. Request Flow (File Upload)
```
User Browser
    │
    ├─> POST /api/files (multipart/form-data)
    │
    ▼
Frontend (Next.js :3000)
    │
    ├─> Proxy to backend
    │
    ▼
Backend API (:5000)
    │
    ├─> Authenticate JWT
    ├─> Parse multipart form
    ├─> Save to local filesystem (/app/uploads)
    ├─> Create MongoDB document
    │   {
    │     filename, size, mimetype, path,
    │     ownerId, folderId, uploadedAt
    │   }
    │
    ├─> Emit event: 'file.uploaded'
    │   eventBus.emit('file.uploaded', { fileId, path, mimetype })
    │
    └─> Return { success: true, file: {...} }

In-Memory Event Bus (same process)
    │
    ├─> Thumbnail Worker subscribes
    │   ├─ Checks if image (image/*)
    │   ├─ Generates thumbnail using Sharp
    │   ├─ Saves thumbnail to /app/uploads/thumbnails/
    │   └─ Updates MongoDB with thumbnail path
    │
    └─> Search Indexer subscribes
        ├─ Extracts text content (if applicable)
        ├─ Tokenizes filename and content
        └─ Updates search index in MongoDB
```

#### 2. Worker Execution (Embedded in Same Process)

**Thumbnail Worker** (`backend/workers/thumbnail.js`):
```javascript
const eventBus = require('../utils/eventBus');
const sharp = require('sharp');

// Subscribe to file upload events
eventBus.subscribe('file.uploaded', async (data) => {
    const { fileId, path, mimetype } = data;

    // Only process images
    if (!mimetype.startsWith('image/')) return;

    try {
        const thumbnailPath = `thumbnails/${fileId}_thumb.jpg`;

        // Generate 200x200 thumbnail
        await sharp(path)
            .resize(200, 200, { fit: 'cover' })
            .jpeg({ quality: 80 })
            .toFile(thumbnailPath);

        // Update database
        await File.findByIdAndUpdate(fileId, { thumbnailPath });

        console.log(`✓ Thumbnail generated: ${fileId}`);
    } catch (error) {
        console.error(`✗ Thumbnail failed: ${error.message}`);
    }
});
```

**Key Characteristic:** Workers run in the **same Node.js process** as the API server. Events are delivered via Node.js EventEmitter (synchronous, in-memory).

#### 3. Storage Layer (Local Filesystem)

**LocalStorageProvider** (`backend/storage/LocalStorageProvider.js`):
```javascript
class LocalStorageProvider {
    constructor() {
        this.uploadDir = process.env.STORAGE_PATH || './uploads';
        fs.mkdirSync(this.uploadDir, { recursive: true });
    }

    async saveFile(file, path) {
        const fullPath = join(this.uploadDir, path);
        await fs.promises.mkdir(dirname(fullPath), { recursive: true });
        await fs.promises.copyFile(file.path, fullPath);
        return { path: fullPath, size: file.size };
    }

    async getFile(path) {
        const fullPath = join(this.uploadDir, path);
        return fs.createReadStream(fullPath);
    }
}
```

**Storage Location:** `/app/uploads/` (Docker volume mounted to host)

#### 4. Database Connection (Embedded MongoDB)

**docker-compose.yml:**
```yaml
services:
  mongodb:
    image: mongo:7
    container_name: opendrive-db
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_USERNAME:-admin}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD:-changeme}
    volumes:
      - mongodb_data:/data/db
    ports:
      - "27017:27017"

  backend:
    environment:
      MONGODB_URI: mongodb://admin:${MONGO_PASSWORD}@mongodb:27017/drive?authSource=admin
```

**Connection String:** Uses Docker's internal DNS (`mongodb:27017`) - containers communicate via Docker network.

### Configuration

**Environment Variables** (`.env`):
```bash
# Core
NODE_ENV=production
PORT=5000
DEPLOYMENT_MODE=monolith  # or omit (defaults to monolith)

# Database
MONGODB_URI=mongodb://admin:password@mongodb:27017/drive?authSource=admin

# Security
JWT_SECRET=your-32-character-secret-here

# Storage
STORAGE_PROVIDER=local
STORAGE_PATH=/app/uploads

# Logging
LOG_LEVEL=info
KAFKA_ENABLED=false  # No Kafka in monolith
```

### Deployment Process

```bash
# 1. Build images (optional - can use pre-built from Docker Hub)
docker-compose build

# 2. Start all services
docker-compose up -d

# 3. Check status
docker-compose ps

# Output:
# opendrive-api       running  0.0.0.0:5000->5000/tcp
# opendrive-web       running  0.0.0.0:3000->3000/tcp
# opendrive-db        running  0.0.0.0:27017->27017/tcp

# 4. View logs
docker-compose logs -f backend
```

### Scaling Limitations

**Single Point of Failure:**
- If backend container crashes, entire API is down
- No load balancing
- No redundancy

**Vertical Scaling Only:**
```bash
# Increase container resources
docker-compose up -d --scale backend=1 \
    --memory 4g \
    --cpus 2
```

**Cannot scale horizontally** because:
1. In-memory event bus doesn't work across processes
2. Local filesystem storage isn't shared
3. No load balancer

### When to Use

✅ **Perfect for:**
- Local development
- Personal projects
- Small teams (<100 users)
- Prototyping
- Cost-sensitive deployments ($0-50/month)

❌ **Avoid for:**
- Production with >1K users
- High availability requirements
- Need for horizontal scaling
- Distributed teams

---

## Architecture 2: Docker + Kafka (VM)

### Overview
Single VM deployment with **load-balanced APIs** and **standalone workers** communicating via Kafka event bus.

### Architecture Diagram
```
┌────────────────────────────────────────────────────────────┐
│              GCP Compute Engine VM                         │
│              e2-standard-4 (4 vCPU, 16GB RAM)              │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────────────────────────────────────────┐    │
│  │         Nginx (Load Balancer) :80                │    │
│  │         Round-robin across API instances         │    │
│  └────────────────┬────────────┬────────────────────┘    │
│                   │            │                          │
│         ┌─────────┴─────┐  ┌──┴──────────┐              │
│         ▼               ▼  ▼             ▼               │
│  ┌─────────────┐  ┌─────────────┐                       │
│  │  API-1      │  │  API-2      │                       │
│  │  :5001      │  │  :5002      │                       │
│  │             │  │             │                       │
│  │  Stateless  │  │  Stateless  │                       │
│  │  No workers │  │  No workers │                       │
│  └──────┬──────┘  └──────┬──────┘                       │
│         │                │                               │
│         └────────┬───────┘                               │
│                  │                                       │
│                  │ Emit events                           │
│                  ▼                                       │
│         ┌────────────────┐                               │
│         │ Kafka Producer │                               │
│         └────────┬───────┘                               │
│                  │                                       │
└──────────────────┼───────────────────────────────────────┘
                   │ Over Internet
                   ▼
┌────────────────────────────────────────────────────────────┐
│            Confluent Cloud Kafka                           │
│            (Managed Event Streaming)                       │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Topics:                                                   │
│  • opendrive-logs-critical  (errors, warnings)            │
│  • opendrive-logs-info      (general logs)                │
│  • opendrive-logs-debug     (verbose logs)                │
│  • file-events              (file.uploaded, file.deleted) │
│                                                            │
│  Consumer Groups:                                          │
│  • thumbnail-workers                                       │
│  • search-indexer-workers                                 │
│  • log-service                                            │
└────────────────┬───────────┬───────────────────────────────┘
                 │           │
       ┌─────────┴──┐    ┌───┴────────┐
       ▼            ▼    ▼            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Back to VM                                │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │ Thumbnail Worker │  │ Search Worker    │               │
│  │ (Standalone)     │  │ (Standalone)     │               │
│  │                  │  │                  │               │
│  │ Kafka Consumer   │  │ Kafka Consumer   │               │
│  │ Group: thumbnail │  │ Group: search    │               │
│  └──────────────────┘  └──────────────────┘               │
│                                                            │
│  ┌──────────────────────────────────────────────────┐    │
│  │         Log Service (Kafka → Loki)               │    │
│  │         Spring Boot application                  │    │
│  │         Consumes from opendrive-logs-*           │    │
│  └─────────────────────┬────────────────────────────┘    │
│                        │                                  │
│                        ▼                                  │
│  ┌──────────────────────────────────────────────────┐    │
│  │         Loki (Log Aggregation)                   │    │
│  │         Stores logs from Kafka                   │    │
│  └─────────────────────┬────────────────────────────┘    │
│                        │                                  │
│                        ▼                                  │
│  ┌──────────────────────────────────────────────────┐    │
│  │         Grafana :3001                            │    │
│  │         Visualizes logs from Loki                │    │
│  │         Dashboards, alerts, search               │    │
│  └──────────────────────────────────────────────────┘    │
│                                                            │
│  ┌──────────────────────────────────────────────────┐    │
│  │         MongoDB (Persistent Volume)              │    │
│  │         Shared by all API instances              │    │
│  └──────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────┘
```

### How It Works

#### 1. Request Flow with Load Balancing

**nginx.conf** (Load Balancer):
```nginx
upstream backend {
    least_conn;  # Route to instance with fewest connections
    server api-1:5001;
    server api-2:5002;
}

server {
    listen 80;

    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location / {
        proxy_pass http://frontend:3000;
    }
}
```

**Request Path:**
```
User → Nginx :80 → API-1 or API-2 → MongoDB
                   ↓
                   Kafka (emit event)
```

#### 2. Kafka Event Bus Architecture

**KafkaEventBus** (`backend/utils/eventBus.js`):
```javascript
const { Kafka, logLevel } = require('kafkajs');

class KafkaEventBus {
    constructor() {
        this.kafka = new Kafka({
            clientId: `opendrive-${process.env.SERVICE_NAME || 'api'}`,
            brokers: [process.env.KAFKA_BOOTSTRAP_SERVERS],
            ssl: true,
            sasl: {
                mechanism: 'plain',
                username: process.env.KAFKA_API_KEY,
                password: process.env.KAFKA_API_SECRET
            },
            logLevel: logLevel.ERROR
        });

        this.producer = this.kafka.producer();
        this.consumers = new Map();
    }

    async connect() {
        await this.producer.connect();
        console.log('✓ Kafka producer connected');
    }

    async emit(event, data) {
        const topic = 'file-events';
        const message = {
            key: event,
            value: JSON.stringify({ event, data, timestamp: Date.now() })
        };

        await this.producer.send({
            topic,
            messages: [message]
        });

        console.log(`→ Event emitted: ${event}`);
    }

    async subscribe(event, handler) {
        const consumer = this.kafka.consumer({
            groupId: process.env.KAFKA_GROUP_ID || 'default-group'
        });

        await consumer.connect();
        await consumer.subscribe({ topic: 'file-events', fromBeginning: false });

        await consumer.run({
            eachMessage: async ({ message }) => {
                const payload = JSON.parse(message.value.toString());

                if (payload.event === event) {
                    await handler(payload.data);
                }
            }
        });

        this.consumers.set(event, consumer);
    }
}
```

**Event Flow:**
```
API-1 uploads file
    │
    ├─> Save to GCS (or local for monolith)
    ├─> Create MongoDB document
    ├─> eventBus.emit('file.uploaded', { fileId, path, mimetype })
    │
    ▼
Kafka Producer
    │
    ├─> Send to topic: 'file-events'
    │   Message: { event: 'file.uploaded', data: {...}, timestamp: ... }
    │
    ▼
Confluent Cloud Kafka
    │
    ├─> Partition: Distribute across brokers
    ├─> Replicate: 3x for durability
    │
    ▼
Kafka Consumer Group: 'thumbnail-workers'
    │
    ├─> Thumbnail Worker (standalone container) receives message
    ├─> Process: Generate thumbnail
    ├─> Upload thumbnail to GCS (or local for monolith)
    └─> Update MongoDB
```

#### 3. Standalone Workers

**thumbnail-standalone.js** (Runs in separate container):
```javascript
const mongoose = require('mongoose');
const eventBus = require('../utils/eventBus');
const sharp = require('sharp');
const storage = require('../storage');

// Environment check
console.log('Starting Thumbnail Worker (Standalone)');
console.log(`Kafka Group: ${process.env.KAFKA_GROUP_ID}`);
console.log(`Service Name: ${process.env.SERVICE_NAME}`);

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Connect to Kafka
eventBus.connect().then(async () => {
    console.log('✓ Connected to Kafka');

    // Subscribe to file upload events
    await eventBus.subscribe('file.uploaded', async (data) => {
        const { fileId, path, mimetype } = data;

        if (!mimetype.startsWith('image/')) {
            console.log(`↷ Skipped non-image: ${fileId}`);
            return;
        }

        try {
            console.log(`⚙ Processing thumbnail: ${fileId}`);

            // Download from storage
            const fileBuffer = await storage.getFile(path);

            // Generate thumbnail
            const thumbnailBuffer = await sharp(fileBuffer)
                .resize(200, 200, { fit: 'cover' })
                .jpeg({ quality: 80 })
                .toBuffer();

            // Upload thumbnail
            const thumbnailPath = `thumbnails/${fileId}_thumb.jpg`;
            await storage.saveFile(thumbnailBuffer, thumbnailPath);

            // Update database
            await File.findByIdAndUpdate(fileId, {
                thumbnailPath,
                thumbnailGeneratedAt: new Date()
            });

            console.log(`✓ Thumbnail generated: ${fileId}`);
        } catch (error) {
            console.error(`✗ Thumbnail failed: ${error.message}`);
        }
    });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down...');
    await eventBus.disconnect();
    await mongoose.connection.close();
    process.exit(0);
});
```

**docker-compose.hybrid.yml:**
```yaml
services:
  api-1:
    image: ${DOCKERHUB_USERNAME}/opendrive-backend:latest
    container_name: opendrive-api-1
    environment:
      DEPLOYMENT_MODE: microservices  # Don't load embedded workers
      SERVICE_NAME: api
      PORT: 5001
      KAFKA_ENABLED: "true"
      KAFKA_BOOTSTRAP_SERVERS: ${KAFKA_BOOTSTRAP_SERVERS}
      KAFKA_API_KEY: ${KAFKA_API_KEY}
      KAFKA_API_SECRET: ${KAFKA_API_SECRET}
    ports:
      - "5001:5001"

  api-2:
    image: ${DOCKERHUB_USERNAME}/opendrive-backend:latest
    container_name: opendrive-api-2
    environment:
      DEPLOYMENT_MODE: microservices
      SERVICE_NAME: api
      PORT: 5002
      KAFKA_ENABLED: "true"
    ports:
      - "5002:5002"

  thumbnail-worker:
    image: ${DOCKERHUB_USERNAME}/opendrive-backend:latest
    container_name: opendrive-thumbnail-worker
    command: node workers/thumbnail-standalone.js
    environment:
      SERVICE_NAME: thumbnail-worker
      KAFKA_GROUP_ID: thumbnail-workers
      KAFKA_ENABLED: "true"
      KAFKA_BOOTSTRAP_SERVERS: ${KAFKA_BOOTSTRAP_SERVERS}
      KAFKA_API_KEY: ${KAFKA_API_KEY}
      KAFKA_API_SECRET: ${KAFKA_API_SECRET}

  search-worker:
    image: ${DOCKERHUB_USERNAME}/opendrive-backend:latest
    container_name: opendrive-search-worker
    command: node workers/searchIndexer-standalone.js
    environment:
      SERVICE_NAME: search-worker
      KAFKA_GROUP_ID: search-indexer-workers
      KAFKA_ENABLED: "true"

  nginx:
    image: nginx:alpine
    container_name: opendrive-nginx
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    ports:
      - "80:80"
    depends_on:
      - api-1
      - api-2
```

#### 4. Logging Pipeline (Kafka → Loki → Grafana)

**Log Flow:**
```
Backend API logs to console
    │
    ├─> Winston Logger with KafkaTransport
    │
    ▼
Kafka Topics (based on log level):
    │
    ├─> opendrive-logs-critical (error, warn)
    ├─> opendrive-logs-info (info)
    └─> opendrive-logs-debug (debug)
    │
    ▼
Log Service (Spring Boot)
    │
    ├─> Kafka Consumer
    ├─> Reads messages from all 3 topics
    ├─> Transforms to Loki format:
    │   {
    │     "streams": [{
    │       "stream": { "job": "opendrive", "level": "error" },
    │       "values": [[ "timestamp", "message" ]]
    │     }]
    │   }
    │
    ▼
Loki (Log Aggregation)
    │
    ├─> Stores logs with labels
    ├─> Indexes by: job, level, service, environment
    │
    ▼
Grafana Dashboard
    │
    ├─> Query: {job="opendrive", level="error"}
    ├─> Visualize: Time series, log panel, alerts
    └─> Export: JSON, CSV, API
```

**KafkaTransport** (Winston Logger):
```javascript
class KafkaTransport extends Transport {
    constructor(opts) {
        super(opts);
        this.topic = opts.topic || 'opendrive-logs';
        this.producer = null;
        this.messageQueue = [];
        this.initProducer();
    }

    async initProducer() {
        const kafka = new Kafka({
            clientId: 'opendrive-logger',
            brokers: [process.env.KAFKA_BOOTSTRAP_SERVERS],
            ssl: true,
            sasl: {
                mechanism: 'plain',
                username: process.env.KAFKA_API_KEY,
                password: process.env.KAFKA_API_SECRET
            }
        });

        this.producer = kafka.producer();
        await this.producer.connect();
    }

    log(info, callback) {
        const { level, message, ...meta } = info;

        // Determine topic based on log level
        let topic;
        if (['error', 'warn'].includes(level)) {
            topic = `${this.topic}-critical`;
        } else if (level === 'debug') {
            topic = `${this.topic}-debug`;
        } else {
            topic = `${this.topic}-info`;
        }

        const kafkaMessage = {
            value: JSON.stringify({
                level,
                message,
                timestamp: new Date().toISOString(),
                service: process.env.SERVICE_NAME,
                ...meta
            })
        };

        this.producer.send({
            topic,
            messages: [kafkaMessage]
        }).then(() => callback()).catch(callback);
    }
}
```

#### 5. Storage Layer (Cloud Storage)

**GCS Storage Provider:**
```javascript
const { Storage } = require('@google-cloud/storage');

class GCSStorageProvider {
    constructor() {
        this.storage = new Storage({
            projectId: process.env.GCS_PROJECT_ID,
            keyFilename: process.env.GCS_KEYFILE
        });
        this.bucket = this.storage.bucket(process.env.GCS_BUCKET);
    }

    async saveFile(file, path) {
        const blob = this.bucket.file(path);
        const stream = blob.createWriteStream({
            resumable: false,
            metadata: { contentType: file.mimetype }
        });

        return new Promise((resolve, reject) => {
            stream.on('error', reject);
            stream.on('finish', () => resolve({ path, size: file.size }));
            fs.createReadStream(file.path).pipe(stream);
        });
    }

    async getFile(path) {
        return this.bucket.file(path).createReadStream();
    }

    async deleteFile(path) {
        await this.bucket.file(path).delete();
    }
}
```

**Why Cloud Storage?**
- ✅ Shared across all API instances
- ✅ No local disk limitations
- ✅ Built-in redundancy
- ✅ CDN integration

### Configuration

**Environment Variables** (`.env.hybrid`):
```bash
# Deployment
DEPLOYMENT_MODE=microservices
SERVICE_NAME=api  # or thumbnail-worker, search-worker

# Kafka (Confluent Cloud)
KAFKA_ENABLED=true
KAFKA_BOOTSTRAP_SERVERS=pkc-xxxxx.us-east-1.aws.confluent.cloud:9092
KAFKA_API_KEY=your-confluent-api-key
KAFKA_API_SECRET=your-confluent-api-secret
KAFKA_TOPIC=opendrive-logs
KAFKA_GROUP_ID=thumbnail-workers  # Per worker type

# Database
MONGODB_URI=mongodb://admin:password@mongodb:27017/drive?authSource=admin

# Storage
STORAGE_PROVIDER=gcs
GCS_PROJECT_ID=my-gcp-project
GCS_BUCKET=opendrive-files
GCS_KEYFILE=/app/gcs-key.json

# Logging
LOG_LEVEL=info
```

### Deployment Process

```bash
# 1. Set up Confluent Cloud Kafka
# - Create Basic cluster (~$10-20/month)
# - Create topics: opendrive-logs-critical, -info, -debug, file-events
# - Generate API credentials

# 2. Deploy to GCP VM
chmod +x deploy-hybrid-gcp.sh
./deploy-hybrid-gcp.sh

# Script does:
# - Creates e2-standard-4 VM
# - Installs Docker & Docker Compose
# - Clones repository
# - Builds images from source
# - Starts all containers
# - Configures Nginx

# 3. Access
# Frontend: http://VM_IP:3000
# API: http://VM_IP:5000 (load balanced)
# Grafana: http://VM_IP:3001
```

### Scaling Capabilities

**Horizontal Scaling (Limited):**
```yaml
# Scale API instances
docker-compose up -d --scale api-1=3 --scale api-2=3

# Update Nginx upstream
upstream backend {
    server api-1:5001;
    server api-2:5002;
    server api-3:5003;
    server api-4:5004;
    server api-5:5005;
    server api-6:5006;
}
```

**Worker Scaling:**
```yaml
# Scale thumbnail workers (Kafka handles distribution)
docker-compose up -d --scale thumbnail-worker=5

# All 5 workers join consumer group 'thumbnail-workers'
# Kafka auto-assigns partitions
```

**Limitations:**
- Still single VM (vertical scaling limit)
- Nginx becomes bottleneck
- No automatic scaling

### When to Use

✅ **Perfect for:**
- Growing startups (1K-5K users)
- Need logging and monitoring
- Want Kafka without full Kubernetes complexity
- Budget ~$100/month
- Production workloads with moderate scale

❌ **Avoid for:**
- >5K concurrent users (VM maxes out)
- Need true auto-scaling
- Variable traffic patterns
- Multi-region deployments

---

## Architecture 3: Serverless (Cloud Run)

### Overview
True cloud-native serverless deployment where each service scales independently from 0 to 1000 instances based on traffic.

### Architecture Diagram
```
                   Internet Traffic
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │   Google Cloud Load Balancer        │
        │   (Automatic, Managed)              │
        └───────────┬─────────────────────────┘
                    │
        ┌───────────┴───────────┬─────────────┬──────────────┐
        │                       │             │              │
        ▼                       ▼             ▼              ▼
┌────────────────┐    ┌────────────────┐   ┌──────────┐   ┌──────────┐
│ Cloud Run:     │    │ Cloud Run:     │   │Cloud Run:│   │Cloud Run:│
│ API Service    │    │ Thumbnail      │   │Search    │   │Frontend  │
│                │    │ Worker         │   │Worker    │   │          │
│ Min: 0         │    │                │   │          │   │          │
│ Max: 10        │    │ Min: 0         │   │ Min: 0   │   │ Min: 0   │
│ CPU: 2         │    │ Max: 5         │   │ Max: 3   │   │ Max: 5   │
│ RAM: 1GB       │    │ CPU: 2         │   │ CPU: 1   │   │ CPU: 1   │
│                │    │ RAM: 2GB       │   │ RAM: 1GB │   │ RAM: 512M│
│ Stateless      │    │                │   │          │   │          │
│ Auto-scale on: │    │ Stateless      │   │Stateless │   │Stateless │
│ • Requests/sec │    │ Auto-scale on: │   │          │   │          │
│ • CPU %        │    │ • Requests     │   │          │   │          │
│ • Concurrency  │    │ • CPU %        │   │          │   │          │
└────────┬───────┘    └────────┬───────┘   └────┬─────┘   └────┬─────┘
         │                     │                 │              │
         └─────────────────────┴─────────────────┴──────────────┘
                               │
                               ▼
         ┌─────────────────────────────────────────────────────┐
         │         Shared External Services                     │
         ├─────────────────────────────────────────────────────┤
         │                                                      │
         │  ┌────────────────────────────────────────┐         │
         │  │   Confluent Cloud Kafka                │         │
         │  │   • Event streaming between services   │         │
         │  │   • Centralized logging                │         │
         │  │   • Topic: file-events                 │         │
         │  │   • Topics: opendrive-logs-*           │         │
         │  └────────────────────────────────────────┘         │
         │                                                      │
         │  ┌────────────────────────────────────────┐         │
         │  │   MongoDB Atlas (M10+ cluster)         │         │
         │  │   • Shared database                    │         │
         │  │   • 3-replica set                      │         │
         │  │   • Auto-failover                      │         │
         │  │   • Backups & point-in-time recovery   │         │
         │  └────────────────────────────────────────┘         │
         │                                                      │
         │  ┌────────────────────────────────────────┐         │
         │  │   Google Cloud Storage (GCS)           │         │
         │  │   • File storage bucket                │         │
         │  │   • CDN-backed                         │         │
         │  │   • Multi-region replication           │         │
         │  └────────────────────────────────────────┘         │
         └─────────────────────────────────────────────────────┘
```

### How It Works

#### 1. Cloud Run Service Auto-Scaling

**Scaling Mechanism:**
```
User requests → Cloud Load Balancer
                      ↓
            Checks current instances
                      ↓
        ┌─────────────┴─────────────┐
        │ All busy (100% CPU)?      │
        │ OR Concurrency maxed?     │
        └─────────────┬─────────────┘
                      │
            YES ←─────┴─────→ NO
             │                 │
             ▼                 ▼
    Spin up new instance   Route to existing
    (Cold start: ~500ms)   (Hot: <10ms)
             │
             ▼
    Instance ready
    Process request
             │
             ▼
    Idle for 15min?
             │
         YES │ NO → Keep running
             ▼
    Scale to zero
    (Stop billing)
```

**Auto-Scaling Configuration:**
```bash
gcloud run deploy opendrive-api \
  --image gcr.io/PROJECT/opendrive-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 5000 \
  --memory 1Gi \
  --cpu 2 \
  --min-instances 0 \          # Scale to zero when idle
  --max-instances 10 \         # Max 10 concurrent instances
  --timeout 300 \              # 5 min request timeout
  --concurrency 80             # 80 requests per instance
```

**Scaling Triggers:**
1. **Request Rate:** If incoming requests > (instances × concurrency), scale up
2. **CPU Utilization:** If avg CPU > 70%, scale up
3. **Memory Pressure:** If memory > 80%, scale up
4. **Cold Start Buffer:** Keep 1 warm instance if traffic detected in last 15min

#### 2. Stateless Service Design

**API Service** (Must be stateless):
```javascript
// ❌ BAD: Stateful (breaks in serverless)
let uploadCache = {};  // In-memory cache lost on scale-down

app.post('/upload', (req, res) => {
    const fileId = generateId();
    uploadCache[fileId] = req.file;  // Won't persist
    // ...
});

// ✅ GOOD: Stateless (works in serverless)
app.post('/upload', async (req, res) => {
    const fileId = generateId();

    // Immediately persist to external storage
    await gcsStorage.saveFile(req.file, `uploads/${fileId}`);

    // Store metadata in database
    await File.create({
        _id: fileId,
        path: `uploads/${fileId}`,
        size: req.file.size
    });

    // Emit event to Kafka
    await eventBus.emit('file.uploaded', { fileId });

    res.json({ success: true, fileId });
});
```

**Why Stateless Matters:**
- Instances can be killed at any time
- No shared filesystem between instances
- Session data must be in database or Redis
- Background tasks must use message queue

#### 3. Worker Services (Event-Driven)

**Thumbnail Worker** (Cloud Run with command override):
```yaml
# deploy-serverless-cloudrun.sh
gcloud run deploy opendrive-thumbnail-worker \
  --image gcr.io/$PROJECT_ID/opendrive-api \  # Same image
  --command node \
  --args workers/thumbnail-standalone.js \     # Different entrypoint
  --platform managed \
  --region $REGION \
  --no-allow-unauthenticated \                 # Internal only
  --memory 2Gi \
  --cpu 2 \
  --min-instances 0 \
  --max-instances 5 \
  --timeout 300 \
  --set-env-vars "KAFKA_ENABLED=true" \
  --set-env-vars "KAFKA_BOOTSTRAP_SERVERS=$KAFKA_BOOTSTRAP_SERVERS" \
  --set-env-vars "SERVICE_NAME=thumbnail-worker"
```

**How Workers Scale:**
```
Kafka has 100 messages in queue
    │
    ├─> Worker-1 (instance) processes 10/sec
    ├─> Queue still backing up
    │
    ▼
Cloud Run detects:
    • Worker CPU at 90%
    • Kafka consumer lag increasing
    │
    ▼
Spin up Worker-2 (new instance)
    │
    ├─> Kafka rebalances partitions
    ├─> Worker-1: Partitions 0-2
    └─> Worker-2: Partitions 3-5
    │
    ▼
Combined throughput: 20/sec
Queue draining
    │
    ▼
Queue empty for 15min
    │
    ▼
Scale Worker-2 to zero (keep Worker-1 warm)
```

#### 4. MongoDB Atlas Integration

**Connection String:**
```bash
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/opendrive?retryWrites=true&w=majority
```

**Atlas Features Used:**
- **3-Replica Set:** Automatic failover (99.95% uptime SLA)
- **Read Preference:** `secondaryPreferred` for read scaling
- **Connection Pooling:** Max 100 connections per Cloud Run instance
- **Monitoring:** Built-in performance insights

**Connection Pool Management:**
```javascript
// backend/db/mongoose.js
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI, {
    maxPoolSize: 10,        // Max connections per instance
    minPoolSize: 2,         // Keep 2 warm
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4               // IPv4 only
});

// Handle Cloud Run scaling
mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected, attempting reconnect...');
});
```

#### 5. Event Communication (Kafka)

**Why Kafka for Serverless:**
- ✅ Durable message queue (messages persist even if workers offline)
- ✅ Decouples services (API doesn't wait for thumbnail generation)
- ✅ Auto-scaling trigger (consumer lag → scale up workers)
- ✅ Replay capability (reprocess events from any offset)

**Event Flow:**
```
API Service (Instance 3)
    │
    ├─> File uploaded
    ├─> Save to GCS
    ├─> Create MongoDB doc
    ├─> Emit to Kafka: { event: 'file.uploaded', fileId: 'abc123' }
    └─> Return response (don't wait for workers)
        │
        ▼
    200 OK to user
        │
        ▼
Kafka persists message
        │
        ▼
Thumbnail Worker (Instance 1)
    │
    ├─> Polls Kafka
    ├─> Receives message (offset 1234)
    ├─> Downloads from GCS
    ├─> Generates thumbnail
    ├─> Uploads thumbnail to GCS
    ├─> Updates MongoDB
    └─> Commits offset (acknowledge)
```

**Kafka Consumer Configuration:**
```javascript
const consumer = kafka.consumer({
    groupId: 'thumbnail-workers',
    sessionTimeout: 30000,
    rebalanceTimeout: 60000,
    heartbeatInterval: 3000,
    retry: {
        retries: 8,
        initialRetryTime: 300
    }
});

await consumer.subscribe({
    topic: 'file-events',
    fromBeginning: false  // Only new messages
});

await consumer.run({
    autoCommit: false,  // Manual commit after processing
    eachMessage: async ({ topic, partition, message }) => {
        const payload = JSON.parse(message.value);

        try {
            await processThumbnail(payload.data);

            // Acknowledge success
            await consumer.commitOffsets([{
                topic,
                partition,
                offset: (parseInt(message.offset) + 1).toString()
            }]);
        } catch (error) {
            console.error('Processing failed, will retry', error);
            // Don't commit offset - message will be redelivered
        }
    }
});
```

#### 6. Cold Start Optimization

**Problem:** First request to scaled-to-zero service takes ~500ms-2s

**Solution 1: Min Instances**
```bash
--min-instances 1  # Keep 1 instance always warm
```
**Cost:** ~$10-20/month per service

**Solution 2: Lazy Initialization**
```javascript
// ❌ BAD: Connect on startup (slow cold start)
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI);  // Blocks container startup

app.listen(5000);

// ✅ GOOD: Connect on first request (fast cold start)
let dbConnected = false;

app.use(async (req, res, next) => {
    if (!dbConnected) {
        await mongoose.connect(process.env.MONGODB_URI);
        dbConnected = true;
    }
    next();
});

app.listen(5000);  // Starts immediately
```

**Solution 3: Container Image Optimization**
```dockerfile
# Use distroless base (smaller image)
FROM gcr.io/distroless/nodejs18

# Multi-stage build (reduce image size)
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM gcr.io/distroless/nodejs18
COPY --from=builder /app/node_modules /app/node_modules
COPY . /app
CMD ["app.js"]
```
**Result:** 200MB image → 80MB image = Faster pulls

### Configuration

**Environment Variables** (`.env.cloudrun`):
```bash
# Deployment
DEPLOYMENT_MODE=microservices
SERVICE_NAME=api  # Different per service

# Database (Atlas)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/opendrive?retryWrites=true&w=majority

# Storage (GCS)
STORAGE_PROVIDER=gcs
GCS_PROJECT_ID=my-project
GCS_BUCKET=opendrive-files

# Kafka (Confluent)
KAFKA_ENABLED=true
KAFKA_BOOTSTRAP_SERVERS=pkc-xxxxx.confluent.cloud:9092
KAFKA_API_KEY=your-api-key
KAFKA_API_SECRET=your-api-secret
KAFKA_GROUP_ID=thumbnail-workers

# Logging
LOG_LEVEL=info
```

### Deployment Process

```bash
# 1. Prerequisites
# - GCP account with billing enabled
# - MongoDB Atlas M10+ cluster
# - Confluent Cloud Kafka cluster
# - gcloud CLI installed

# 2. Run deployment script
chmod +x deploy-serverless-cloudrun.sh
./deploy-serverless-cloudrun.sh

# Script performs:
# 1. Enable Cloud Run API
# 2. Clone repository
# 3. Build containers using Cloud Build
# 4. Deploy 4 Cloud Run services:
#    - opendrive-api (public, port 5000)
#    - opendrive-thumbnail-worker (internal)
#    - opendrive-search-worker (internal)
#    - opendrive-frontend (public, port 3000)
# 5. Configure service-to-service auth
# 6. Output URLs

# 3. Access
# Frontend: https://opendrive-frontend-xxxxx-uc.a.run.app
# API: https://opendrive-api-xxxxx-uc.a.run.app
```

### Cost Optimization

**Pay-per-Use Model:**
```
Cost = (CPU-seconds × $0.00002400) + (GB-seconds × $0.00000250) + (Requests × $0.40 per million)

Example (1000 req/day, avg 200ms response):
• API Service:
  - CPU-seconds: 1000 × 0.2s = 200
  - GB-seconds: 200 × 1GB = 200
  - Requests: 1000
  - Daily cost: (200 × $0.000024) + (200 × $0.0000025) + (1000/1M × $0.40) = $0.0053
  - Monthly cost: $0.16

• Thumbnail Worker (100 images/day):
  - CPU-seconds: 100 × 5s = 500
  - GB-seconds: 500 × 2GB = 1000
  - Daily cost: (500 × $0.000024) + (1000 × $0.0000025) = $0.0145
  - Monthly cost: $0.44

Total: ~$0.60/month (plus Atlas $60 + Kafka $10 = $70.60/month minimum)
```

**Cost at Scale:**
| Traffic Level | API Instances | Worker Instances | Monthly Cost |
|---------------|---------------|------------------|--------------|
| Idle (0 req) | 0 | 0 | $0 (+ $70 external) |
| Light (1K users) | 0-2 | 0-1 | $30 (+ $70 = $100) |
| Medium (5K users) | 2-5 | 1-3 | $80 (+ $70 = $150) |
| Heavy (10K users) | 5-10 | 3-5 | $150 (+ $70 = $220) |

### When to Use

✅ **Perfect for:**
- Variable traffic (scales to zero when idle)
- 5K-15K concurrent users
- Want zero infrastructure management
- Budget $70-230/month
- Unpredictable growth
- Global CDN needed

❌ **Avoid for:**
- Need <100ms latency (cold starts)
- Persistent connections (WebSockets)
- Stateful workloads
- Regulatory requirement for dedicated servers

---

## Architecture 4: Kubernetes (GKE)

### Overview
Production-grade Kubernetes cluster with Horizontal Pod Autoscaling, self-healing, and multi-zone high availability.

### Architecture Diagram
```
                       Internet Traffic
                              │
                              ▼
        ┌──────────────────────────────────────────────┐
        │   GCP Cloud Load Balancer                    │
        │   (Global, Anycast IP)                       │
        └───────────────────┬──────────────────────────┘
                            │
                            ▼
        ┌──────────────────────────────────────────────┐
        │   Kubernetes Ingress Controller              │
        │   (nginx-ingress or GKE Ingress)             │
        │   Rules:                                     │
        │   • /api/* → opendrive-api-service           │
        │   • /* → opendrive-frontend-service          │
        └───────────────────┬──────────────────────────┘
                            │
        ┌───────────────────┴───────────────┐
        │                                   │
        ▼                                   ▼
┌────────────────────────────────────────────────────────────────┐
│                  GKE Cluster (Auto-scaling)                    │
│                  2-10 nodes (e2-standard-4 each)               │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │   API Deployment (opendrive-api)                     │    │
│  │   ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐   │    │
│  │   │ Pod 1  │  │ Pod 2  │  │ Pod 3  │  │ Pod 4  │   │    │
│  │   │ :5000  │  │ :5000  │  │ :5000  │  │ :5000  │   │    │
│  │   │ 1 CPU  │  │ 1 CPU  │  │ 1 CPU  │  │ 1 CPU  │   │    │
│  │   │ 512MB  │  │ 512MB  │  │ 512MB  │  │ 512MB  │   │    │
│  │   └────────┘  └────────┘  └────────┘  └────────┘   │    │
│  │   Replicas: 2-10 (Horizontal Pod Autoscaler)        │    │
│  │   Scaling triggers:                                 │    │
│  │   • CPU > 70%                                       │    │
│  │   • Memory > 80%                                    │    │
│  │   • Custom metrics (requests/sec, latency)         │    │
│  └──────────────────────────────────────────────────────┘    │
│                              │                                │
│                              ▼                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │   Service (opendrive-api-service)                    │    │
│  │   Type: ClusterIP                                    │    │
│  │   Port: 80 → TargetPort: 5000                       │    │
│  │   Load balances across all API pods                 │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │   Worker Deployments                                 │    │
│  │                                                       │    │
│  │   ┌────────────────────────────┐                     │    │
│  │   │ Thumbnail Worker           │                     │    │
│  │   │ ┌──────┐  ┌──────┐         │                     │    │
│  │   │ │ Pod  │  │ Pod  │         │                     │    │
│  │   │ └──────┘  └──────┘         │                     │    │
│  │   │ Replicas: 1-5 (HPA)        │                     │    │
│  │   └────────────────────────────┘                     │    │
│  │                                                       │    │
│  │   ┌────────────────────────────┐                     │    │
│  │   │ Search Worker              │                     │    │
│  │   │ ┌──────┐                   │                     │    │
│  │   │ │ Pod  │                   │                     │    │
│  │   │ └──────┘                   │                     │    │
│  │   │ Replicas: 1-3 (HPA)        │                     │    │
│  │   └────────────────────────────┘                     │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │   Frontend Deployment (opendrive-frontend)           │    │
│  │   ┌────────┐  ┌────────┐                            │    │
│  │   │ Pod 1  │  │ Pod 2  │                            │    │
│  │   │ :3000  │  │ :3000  │                            │    │
│  │   └────────┘  └────────┘                            │    │
│  │   Replicas: 2 (fixed)                               │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │   ConfigMaps & Secrets                               │    │
│  │   • opendrive-secrets (MongoDB URI, JWT, Kafka)     │    │
│  │   • opendrive-config (Environment variables)        │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │   Persistent Volumes (if using StatefulSets)         │    │
│  │   • opendrive-mongodb-pv (optional)                 │    │
│  └──────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────┘
                            │
                            ▼
        ┌──────────────────────────────────────────────┐
        │     External Services (Managed)              │
        ├──────────────────────────────────────────────┤
        │  • MongoDB Atlas (M10+ cluster)              │
        │  • Confluent Cloud Kafka                     │
        │  • Google Cloud Storage (GCS)                │
        └──────────────────────────────────────────────┘
```

### How It Works

#### 1. GKE Cluster Autoscaling

**Node-Level Autoscaling:**
```bash
gcloud container clusters create opendrive-cluster \
  --zone=us-central1-a \
  --machine-type=e2-standard-4 \     # 4 vCPU, 16GB RAM per node
  --num-nodes=2 \                    # Initial node count
  --enable-autoscaling \
  --min-nodes=2 \                    # Always keep 2 nodes
  --max-nodes=10 \                   # Scale up to 10 nodes
  --enable-autorepair \              # Auto-fix unhealthy nodes
  --enable-autoupgrade \             # Auto-update K8s version
  --disk-size=50 \                   # 50GB disk per node
  --disk-type=pd-standard \
  --enable-ip-alias \
  --enable-stackdriver-kubernetes \  # Monitoring & logging
  --addons=HorizontalPodAutoscaling,HttpLoadBalancing
```

**How Node Autoscaling Works:**
```
Scheduler tries to place new pod
    │
    ├─> Check available resources on nodes
    │
    ▼
Node 1: 3.5/4 vCPU used (87%)
Node 2: 3.8/4 vCPU used (95%)
    │
    ├─> No node has capacity for new pod (needs 1 vCPU)
    │
    ▼
Cluster Autoscaler detects unschedulable pod
    │
    ├─> Calculates: Need 1 more node
    ├─> Checks: Current nodes (2) < Max nodes (10) ✓
    │
    ▼
Provision new node (Node 3)
    │
    ├─> Request to GCE: Create e2-standard-4 instance
    ├─> Wait ~90 seconds for VM to boot
    ├─> Install kubelet, kube-proxy
    ├─> Register with control plane
    │
    ▼
Node 3 ready (0/4 vCPU used)
    │
    ├─> Scheduler places pod on Node 3
    │
    ▼
Pod running, traffic flowing

---

After 10 minutes of low utilization:
Node 3: 0.2/4 vCPU used (5%)
Node 1 & 2 could handle load
    │
    ▼
Cluster Autoscaler detects under-utilization
    │
    ├─> Simulates: Can we drain Node 3?
    ├─> Checks: Are pods reschedulable? ✓
    │
    ▼
Drain Node 3
    │
    ├─> Cordon node (no new pods)
    ├─> Evict pods gracefully (SIGTERM)
    ├─> Pods restart on Node 1/2
    ├─> Delete GCE instance
    │
    ▼
Back to 2 nodes (saving $75/month)
```

#### 2. Horizontal Pod Autoscaling (HPA)

**API Deployment with HPA:**
```yaml
# api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: opendrive-api
  namespace: opendrive
spec:
  replicas: 2  # Initial replicas (overridden by HPA)
  selector:
    matchLabels:
      app: opendrive-api
  template:
    metadata:
      labels:
        app: opendrive-api
    spec:
      containers:
      - name: api
        image: gcr.io/PROJECT_ID/opendrive-api:latest
        ports:
        - containerPort: 5000
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"      # Request 0.5 CPU
          limits:
            memory: "1Gi"
            cpu: "1000m"     # Max 1 CPU
        livenessProbe:
          httpGet:
            path: /api/health
            port: 5000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 5000
          initialDelaySeconds: 10
          periodSeconds: 5
        env:
        - name: NODE_ENV
          value: "production"
        - name: DEPLOYMENT_MODE
          value: "microservices"
        - name: MONGODB_URI
          valueFrom:
            secretKeyRef:
              name: opendrive-secrets
              key: mongodb-uri
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: opendrive-api-hpa
  namespace: opendrive
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: opendrive-api
  minReplicas: 2       # Always run at least 2 pods
  maxReplicas: 10      # Scale up to 10 pods
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70    # Target 70% CPU across all pods
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80    # Target 80% memory
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 0  # Scale up immediately
      policies:
      - type: Percent
        value: 100                   # Double pods
        periodSeconds: 15            # Every 15 seconds
      - type: Pods
        value: 2                     # Or add 2 pods
        periodSeconds: 15
      selectPolicy: Max              # Use fastest policy
    scaleDown:
      stabilizationWindowSeconds: 300  # Wait 5 min before scaling down
      policies:
      - type: Percent
        value: 50                      # Remove 50% of pods
        periodSeconds: 60              # Every minute
```

**HPA Scaling Logic:**
```
Current state: 2 API pods running
    │
    ├─> Metrics Server collects metrics every 15 seconds:
    │   Pod 1: 80% CPU, 60% memory
    │   Pod 2: 85% CPU, 65% memory
    │   Average: 82.5% CPU, 62.5% memory
    │
    ▼
HPA evaluates:
    Target CPU: 70%
    Actual CPU: 82.5%
    │
    ├─> Calculate desired replicas:
    │   desired = ceil(current × (actual / target))
    │   desired = ceil(2 × (82.5 / 70))
    │   desired = ceil(2.36) = 3 pods
    │
    ▼
Scale up to 3 pods
    │
    ├─> Deployment creates Pod 3
    ├─> Scheduler places on Node 2
    ├─> Wait for readinessProbe to pass
    ├─> Service adds Pod 3 to endpoints
    │
    ▼
Traffic distributed across 3 pods
    │
    ├─> New metrics:
    │   Pod 1: 55% CPU
    │   Pod 2: 60% CPU
    │   Pod 3: 50% CPU
    │   Average: 55% CPU
    │
    ▼
Below target (70%), but wait 5 min (stabilizationWindow)
    │
    ├─> After 5 min, still at 55% CPU average
    │
    ▼
Scale down to 2 pods
    │
    ├─> Deployment terminates Pod 3
    ├─> SIGTERM sent to container
    ├─> Graceful shutdown (finish requests)
    ├─> Pod removed from service endpoints
    │
    ▼
Back to 2 pods
```

#### 3. Service Mesh & Load Balancing

**Service Definition:**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: opendrive-api-service
  namespace: opendrive
spec:
  selector:
    app: opendrive-api  # Routes to pods with this label
  ports:
  - protocol: TCP
    port: 80           # External port
    targetPort: 5000   # Pod port
  type: ClusterIP      # Internal only
```

**How Service Load Balancing Works:**
```
Request arrives at Service IP (10.96.0.1:80)
    │
    ▼
kube-proxy (running on every node)
    │
    ├─> iptables rules route to backend pods
    │
    ▼
Available endpoints:
    • 10.244.1.5:5000 (Pod 1 on Node 1)
    • 10.244.2.3:5000 (Pod 2 on Node 2)
    • 10.244.1.8:5000 (Pod 3 on Node 1)
    │
    ├─> Select endpoint using round-robin
    │
    ▼
Forward to Pod 2 (10.244.2.3:5000)
    │
    ├─> If Pod 2 fails health check:
    │   ├─> Endpoint removed from list
    │   └─> Future requests skip Pod 2
    │
    ▼
Response returned through same path
```

**Ingress Configuration:**
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: opendrive-ingress
  namespace: opendrive
  annotations:
    kubernetes.io/ingress.class: "gce"
    kubernetes.io/ingress.global-static-ip-name: "opendrive-ip"
spec:
  rules:
  - http:
      paths:
      - path: /api/*
        pathType: ImplementationSpecific
        backend:
          service:
            name: opendrive-api-service
            port:
              number: 80
      - path: /*
        pathType: ImplementationSpecific
        backend:
          service:
            name: opendrive-frontend-service
            port:
              number: 80
```

**Ingress Flow:**
```
Internet → GCP Load Balancer (global IP)
              │
              ▼
          GKE Ingress Controller
              │
              ├─> /api/files → opendrive-api-service:80
              ├─> /api/folders → opendrive-api-service:80
              └─> / → opendrive-frontend-service:80
              │
              ▼
          ClusterIP Services
              │
              ▼
          Backend Pods
```

#### 4. Self-Healing & Rolling Updates

**Self-Healing (Liveness Probe):**
```yaml
livenessProbe:
  httpGet:
    path: /api/health
    port: 5000
  initialDelaySeconds: 30  # Wait 30s after start
  periodSeconds: 10        # Check every 10s
  timeoutSeconds: 5        # Timeout after 5s
  failureThreshold: 3      # Fail after 3 consecutive failures
```

**What Happens When Pod Crashes:**
```
Pod 2 becomes unhealthy
    │
    ├─> Liveness probe fails 3 times
    │
    ▼
Kubelet detects failure
    │
    ├─> Restart container in place (same pod)
    │
    ▼
Container restarts
    │
    ├─> initialDelaySeconds: Wait 30s
    ├─> readinessProbe: Check health
    │
    ▼
If healthy: Add back to service endpoints
If still unhealthy after 10 restarts: CrashLoopBackOff
    │
    ├─> Exponential backoff (10s, 20s, 40s, 80s, max 5min)
    │
    ▼
Alert triggers (if configured)
```

**Rolling Update (Zero Downtime):**
```bash
# Update image
kubectl set image deployment/opendrive-api \
  api=gcr.io/PROJECT_ID/opendrive-api:v2 \
  -n opendrive
```

**Rolling Update Process:**
```
Current state: 4 pods running (v1)
    │
    ▼
Deployment controller detects image change
    │
    ├─> Strategy: RollingUpdate
    │   • maxSurge: 1 (can have 5 pods during update)
    │   • maxUnavailable: 1 (can have 3 pods temporarily)
    │
    ▼
Create Pod 5 with v2 image
    │
    ├─> Wait for readinessProbe to pass
    │
    ▼
Pod 5 ready (v2)
    │
    ├─> Service starts routing to Pod 5
    │
    ▼
Terminate Pod 1 (v1)
    │
    ├─> SIGTERM (graceful shutdown)
    ├─> Remove from service endpoints
    ├─> Wait 30s for requests to drain
    ├─> SIGKILL if still running
    │
    ▼
Create Pod 6 with v2 image
    │
    ▼
Repeat until all pods are v2
    │
    ▼
Final state: 4 pods running (v2)

During entire process:
    • At least 3 pods serving traffic
    • No downtime
    • If v2 fails health checks, rollback automatically
```

#### 5. Secrets Management

**Creating Secrets:**
```bash
kubectl create secret generic opendrive-secrets \
  --from-literal=mongodb-uri='mongodb+srv://...' \
  --from-literal=jwt-secret='your-secret' \
  --from-literal=kafka-bootstrap-servers='pkc-xxx.confluent.cloud:9092' \
  --from-literal=kafka-api-key='your-key' \
  --from-literal=kafka-api-secret='your-secret' \
  -n opendrive
```

**Using Secrets in Pods:**
```yaml
env:
- name: MONGODB_URI
  valueFrom:
    secretKeyRef:
      name: opendrive-secrets
      key: mongodb-uri
- name: JWT_SECRET
  valueFrom:
    secretKeyRef:
      name: opendrive-secrets
      key: jwt-secret
```

**Secrets are:**
- Base64 encoded (not encrypted by default)
- Mounted as environment variables or files
- Not logged or shown in kubectl describe
- Can integrate with GCP Secret Manager for encryption at rest

#### 6. Multi-Zone High Availability

**Node Distribution:**
```bash
# Create regional cluster (spans 3 zones)
gcloud container clusters create opendrive-cluster \
  --region=us-central1 \        # Not --zone (regional, not zonal)
  --num-nodes=1 \               # 1 node per zone = 3 total
  --enable-autoscaling \
  --min-nodes=1 \               # 1 per zone = 3 min
  --max-nodes=3                 # 3 per zone = 9 max
```

**Pod Anti-Affinity (spread across zones):**
```yaml
spec:
  affinity:
    podAntiAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchExpressions:
            - key: app
              operator: In
              values:
              - opendrive-api
          topologyKey: topology.kubernetes.io/zone
```

**Result:**
```
Zone A (us-central1-a):
    • Node 1
    ├─> API Pod 1
    └─> Frontend Pod 1

Zone B (us-central1-b):
    • Node 2
    ├─> API Pod 2
    └─> Thumbnail Worker Pod 1

Zone C (us-central1-c):
    • Node 3
    ├─> API Pod 3
    └─> Search Worker Pod 1
```

**If Zone A fails:**
- Nodes in Zone B & C continue serving traffic
- API Pod 1 is rescheduled to Zone B or C
- No downtime (assuming minReplicas ≥ 2)

### Configuration

**Kubernetes Manifests:**

**1. Namespace:**
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: opendrive
```

**2. Secrets:**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: opendrive-secrets
  namespace: opendrive
type: Opaque
stringData:
  mongodb-uri: "mongodb+srv://..."
  jwt-secret: "your-secret"
  kafka-bootstrap-servers: "pkc-xxx.confluent.cloud:9092"
  kafka-api-key: "your-key"
  kafka-api-secret: "your-secret"
```

**3. API Deployment (see earlier)**

**4. Worker Deployments:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: thumbnail-worker
  namespace: opendrive
spec:
  replicas: 1
  selector:
    matchLabels:
      app: thumbnail-worker
  template:
    metadata:
      labels:
        app: thumbnail-worker
    spec:
      containers:
      - name: worker
        image: gcr.io/PROJECT_ID/opendrive-api:latest
        command: ["node", "workers/thumbnail-standalone.js"]
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        env:
        - name: SERVICE_NAME
          value: "thumbnail-worker"
        - name: KAFKA_GROUP_ID
          value: "thumbnail-workers"
        - name: MONGODB_URI
          valueFrom:
            secretKeyRef:
              name: opendrive-secrets
              key: mongodb-uri
```

### Deployment Process

```bash
# 1. Run deployment script
chmod +x deploy-gke-kubernetes.sh
./deploy-gke-kubernetes.sh

# Script performs:
# 1. Create GKE cluster
# 2. Build container images
# 3. Generate Kubernetes manifests
# 4. Apply manifests:
#    kubectl apply -f k8s/namespace.yaml
#    kubectl apply -f k8s/secrets.yaml
#    kubectl apply -f k8s/api-deployment.yaml
#    kubectl apply -f k8s/workers-deployment.yaml
#    kubectl apply -f k8s/frontend-deployment.yaml
#    kubectl apply -f k8s/ingress.yaml
# 5. Wait for pods to be ready
# 6. Output load balancer IP

# 2. Verify deployment
kubectl get pods -n opendrive
kubectl get svc -n opendrive
kubectl get hpa -n opendrive

# 3. View logs
kubectl logs -f deployment/opendrive-api -n opendrive

# 4. Scale manually (overrides HPA temporarily)
kubectl scale deployment opendrive-api --replicas=5 -n opendrive
```

### Monitoring & Observability

**Built-in Monitoring:**
```bash
# GKE Monitoring (Stackdriver)
gcloud container clusters get-credentials opendrive-cluster
kubectl top nodes     # Node CPU/memory
kubectl top pods -n opendrive     # Pod CPU/memory

# View in GCP Console
# https://console.cloud.google.com/kubernetes/list
# - Workloads (deployments, pods)
# - Services & Ingress
# - Storage (persistent volumes)
# - Logs (Cloud Logging integration)
```

**Custom Metrics (Prometheus):**
```yaml
# prometheus-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prometheus
  namespace: monitoring
spec:
  replicas: 1
  template:
    spec:
      containers:
      - name: prometheus
        image: prom/prometheus:latest
        ports:
        - containerPort: 9090
        volumeMounts:
        - name: config
          mountPath: /etc/prometheus
---
# ServiceMonitor for API pods
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: opendrive-api
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: opendrive-api
  endpoints:
  - port: metrics
    interval: 30s
```

### Cost Breakdown

**Monthly Costs (GKE):**
| Component | Min Config | Max Config |
|-----------|------------|------------|
| **GKE Control Plane** | $75 | $75 |
| **Worker Nodes (2-10)** | 2×$75 = $150 | 10×$75 = $750 |
| **Load Balancer** | $20 | $20 |
| **Persistent Disks** | $10 | $50 |
| **Egress (1TB)** | $120 | $120 |
| **MongoDB Atlas** | $60 | $60 |
| **Confluent Kafka** | $10 | $20 |
| **Total** | **$445/mo** | **$1,095/mo** |

**Cost Optimization:**
- Use Preemptible VMs: Save 80% ($15/node vs $75/node)
- Regional cluster: Better HA, same cost
- Committed use discounts: Save 57% with 3-year commit

### When to Use

✅ **Perfect for:**
- Production workloads at scale (10K+ users)
- Need 99.9%+ uptime
- Have DevOps expertise
- Complex multi-service applications
- Compliance requirements (PCI, HIPAA, SOC 2)
- Budget $300-1000/month

❌ **Avoid for:**
- Small projects (<1K users)
- No Kubernetes experience
- Want zero ops overhead
- Budget <$200/month

---

## Core Components Deep Dive

### Event Bus Architecture

OpenDrive uses an **EventBus abstraction** that automatically selects between in-memory (monolith) and Kafka (microservices) implementations.

**eventBus.js** (Abstraction Layer):
```javascript
// backend/utils/eventBus.js
const deploymentMode = (process.env.DEPLOYMENT_MODE || 'monolith').toLowerCase();

let eventBusInstance;

if (deploymentMode === 'microservices' && process.env.KAFKA_ENABLED === 'true') {
    console.log('Using Kafka Event Bus');
    const KafkaEventBus = require('./KafkaEventBus');
    eventBusInstance = new KafkaEventBus();
} else {
    console.log('Using In-Memory Event Bus');
    const InMemoryEventBus = require('./InMemoryEventBus');
    eventBusInstance = new InMemoryEventBus();
}

module.exports = eventBusInstance;
```

**InMemoryEventBus** (Monolith):
```javascript
const EventEmitter = require('events');

class InMemoryEventBus extends EventEmitter {
    async connect() {
        console.log('✓ In-Memory Event Bus initialized');
    }

    async emit(event, data) {
        super.emit(event, data);
        console.log(`→ Event emitted (in-memory): ${event}`);
    }

    async subscribe(event, handler) {
        this.on(event, handler);
        console.log(`✓ Subscribed to: ${event}`);
    }

    async disconnect() {
        this.removeAllListeners();
    }
}

module.exports = InMemoryEventBus;
```

**KafkaEventBus** (Microservices):
```javascript
const { Kafka, logLevel } = require('kafkajs');

class KafkaEventBus {
    constructor() {
        this.kafka = new Kafka({
            clientId: `opendrive-${process.env.SERVICE_NAME}`,
            brokers: process.env.KAFKA_BOOTSTRAP_SERVERS.split(','),
            ssl: true,
            sasl: {
                mechanism: 'plain',
                username: process.env.KAFKA_API_KEY,
                password: process.env.KAFKA_API_SECRET
            },
            retry: {
                initialRetryTime: 300,
                retries: 8
            },
            logLevel: logLevel.ERROR
        });

        this.producer = this.kafka.producer({
            allowAutoTopicCreation: false,
            transactionTimeout: 30000
        });

        this.consumers = new Map();
        this.connected = false;
    }

    async connect() {
        if (this.connected) return;

        await this.producer.connect();
        this.connected = true;
        console.log('✓ Kafka producer connected');
    }

    async emit(event, data) {
        if (!this.connected) await this.connect();

        const message = {
            key: event,
            value: JSON.stringify({
                event,
                data,
                timestamp: Date.now(),
                service: process.env.SERVICE_NAME
            }),
            headers: {
                'content-type': 'application/json'
            }
        };

        await this.producer.send({
            topic: 'file-events',
            messages: [message]
        });

        console.log(`→ Event emitted to Kafka: ${event}`);
    }

    async subscribe(event, handler) {
        const groupId = process.env.KAFKA_GROUP_ID || 'default-group';

        const consumer = this.kafka.consumer({
            groupId,
            sessionTimeout: 30000,
            heartbeatInterval: 3000
        });

        await consumer.connect();
        await consumer.subscribe({
            topic: 'file-events',
            fromBeginning: false
        });

        await consumer.run({
            autoCommit: false,
            eachMessage: async ({ topic, partition, message }) => {
                try {
                    const payload = JSON.parse(message.value.toString());

                    if (payload.event === event) {
                        console.log(`← Received event: ${event}`);
                        await handler(payload.data);

                        // Manual commit after successful processing
                        await consumer.commitOffsets([{
                            topic,
                            partition,
                            offset: (parseInt(message.offset) + 1).toString()
                        }]);
                    }
                } catch (error) {
                    console.error(`✗ Event processing failed: ${error.message}`);
                    // Don't commit - message will be redelivered
                }
            }
        });

        this.consumers.set(event, consumer);
        console.log(`✓ Subscribed to Kafka: ${event} (group: ${groupId})`);
    }

    async disconnect() {
        await this.producer.disconnect();

        for (const consumer of this.consumers.values()) {
            await consumer.disconnect();
        }

        this.connected = false;
        console.log('✓ Kafka disconnected');
    }
}

module.exports = KafkaEventBus;
```

**Usage in Application Code:**
```javascript
// backend/routes/files.js
const eventBus = require('../utils/eventBus');

router.post('/upload', upload.single('file'), async (req, res) => {
    // Save file
    const file = await storage.saveFile(req.file, path);

    // Create database record
    const fileDoc = await File.create({
        filename: req.file.originalname,
        path: file.path,
        size: file.size,
        mimetype: req.file.mimetype,
        ownerId: req.user._id
    });

    // Emit event (abstraction handles in-memory vs Kafka)
    await eventBus.emit('file.uploaded', {
        fileId: fileDoc._id.toString(),
        path: file.path,
        mimetype: req.file.mimetype
    });

    res.json({ success: true, file: fileDoc });
});
```

---

## Storage Abstraction Layer

**storage/index.js** (Factory Pattern):
```javascript
const provider = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();
let storageInstance;

switch (provider) {
    case 'gcs':
        const GCSStorageProvider = require('./GCSStorageProvider');
        storageInstance = new GCSStorageProvider();
        break;
    case 's3':
        const S3StorageProvider = require('./S3StorageProvider');
        storageInstance = new S3StorageProvider();
        break;
    case 'local':
    default:
        const LocalStorageProvider = require('./LocalStorageProvider');
        storageInstance = new LocalStorageProvider();
        break;
}

console.log(`✓ Storage provider initialized: ${provider}`);

module.exports = storageInstance;
```

**Interface (All Providers Must Implement):**
```javascript
class StorageProvider {
    async saveFile(file, path) {
        throw new Error('Not implemented');
    }

    async getFile(path) {
        throw new Error('Not implemented');
    }

    async deleteFile(path) {
        throw new Error('Not implemented');
    }

    async moveFile(oldPath, newPath) {
        throw new Error('Not implemented');
    }

    async getSignedUrl(path, expiresIn) {
        throw new Error('Not implemented');
    }
}
```

---

## Logging & Monitoring

**Winston Logger with Kafka Transport:**
```javascript
// backend/utils/logger.js
const winston = require('winston');
const KafkaTransport = require('./KafkaTransport');

const transports = [
    new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    })
];

if (process.env.KAFKA_ENABLED === 'true') {
    transports.push(
        new KafkaTransport({
            topic: process.env.KAFKA_TOPIC || 'opendrive-logs',
            level: 'info'
        })
    );
}

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.json(),
    defaultMeta: {
        service: process.env.SERVICE_NAME || 'api',
        environment: process.env.NODE_ENV
    },
    transports
});

module.exports = logger;
```

---

## Configuration Management

**Environment Variable Hierarchy:**
```
1. Docker Compose .env file (lowest priority)
2. Kubernetes ConfigMap
3. Kubernetes Secrets
4. Cloud Run environment variables
5. Process environment variables (highest priority)
```

**Example .env for Each Architecture:**

**Monolith:**
```bash
DEPLOYMENT_MODE=monolith
MONGODB_URI=mongodb://admin:password@mongodb:27017/drive
STORAGE_PROVIDER=local
KAFKA_ENABLED=false
```

**Docker + Kafka:**
```bash
DEPLOYMENT_MODE=microservices
SERVICE_NAME=api
KAFKA_ENABLED=true
KAFKA_BOOTSTRAP_SERVERS=pkc-xxx.confluent.cloud:9092
KAFKA_API_KEY=your-key
KAFKA_API_SECRET=your-secret
KAFKA_GROUP_ID=api-group
STORAGE_PROVIDER=gcs
GCS_BUCKET=opendrive-files
```

**Serverless:**
```bash
DEPLOYMENT_MODE=microservices
SERVICE_NAME=api
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/drive
STORAGE_PROVIDER=gcs
KAFKA_ENABLED=true
```

**Kubernetes:**
```yaml
# In Kubernetes Secret (base64 encoded)
apiVersion: v1
kind: Secret
metadata:
  name: opendrive-secrets
type: Opaque
data:
  mongodb-uri: bW9uZ29kYjovL3VzZXI6cGFzc0BjbHVzdGVyLm1vbmdvZGIubmV0L2RyaXZl
  kafka-bootstrap-servers: cGtjLXh4eC5jb25mbHVlbnQuY2xvdWQ6OTA5Mg==
```

---

## Migration Guide

### Monolith → Docker + Kafka (VM)

**Prerequisites:**
1. Confluent Cloud Kafka cluster
2. GCP account (for Compute Engine)

**Steps:**
```bash
# 1. Export data from monolith MongoDB
docker exec opendrive-db mongodump --out /backup

# 2. Set up Confluent Kafka
# - Create cluster
# - Create topics: file-events, opendrive-logs-*
# - Generate API credentials

# 3. Deploy to GCP VM
./deploy-hybrid-gcp.sh

# 4. Import data to VM MongoDB
gcloud compute scp --recurse /backup opendrive-vm:~/
gcloud compute ssh opendrive-vm
docker exec -it opendrive-db mongorestore /backup

# 5. Update DNS
# Point your domain to VM's static IP

# 6. Verify
curl http://VM_IP:5000/api/health
```

**Downtime:** ~15-30 minutes (during data migration)

### Docker + Kafka → Serverless (Cloud Run)

**Prerequisites:**
1. MongoDB Atlas M10+ cluster
2. Google Cloud Storage bucket
3. Confluent Cloud Kafka (already have)

**Steps:**
```bash
# 1. Set up MongoDB Atlas
# - Create M10 cluster (~10 min to provision)
# - Whitelist IPs or enable "Allow from anywhere"
# - Create database user

# 2. Migrate MongoDB data
mongodump --uri="mongodb://vm-mongodb:27017/drive" --out=./dump
mongorestore --uri="mongodb+srv://atlas-cluster.mongodb.net/drive" ./dump

# 3. Migrate files to GCS
gsutil -m cp -r /vm/uploads/* gs://opendrive-files/

# 4. Deploy to Cloud Run
./deploy-serverless-cloudrun.sh

# 5. Update DNS
# Point to Cloud Run URL (or custom domain via Cloud Load Balancer)

# 6. Decommission VM
gcloud compute instances delete opendrive-vm
```

**Downtime:** ~5 minutes (DNS propagation)

### Serverless → Kubernetes

**Steps:**
```bash
# 1. Deploy GKE cluster
./deploy-gke-kubernetes.sh

# 2. MongoDB and GCS remain the same (no migration needed)

# 3. Update DNS
# Point to GKE Ingress IP

# 4. Delete Cloud Run services
gcloud run services delete opendrive-api --region us-central1
gcloud run services delete opendrive-thumbnail-worker --region us-central1
gcloud run services delete opendrive-search-worker --region us-central1
gcloud run services delete opendrive-frontend --region us-central1
```

**Downtime:** None (blue-green deployment possible)

---

## Summary

| Architecture | Best For | Complexity | Cost | Scaling | HA |
|--------------|----------|------------|------|---------|-----|
| **Monolith** | Dev, Small teams | ⭐ Simple | $0-50 | Manual | ❌ |
| **Docker + Kafka** | Growing startups | ⭐⭐ Moderate | ~$100 | Limited | ⚠️ |
| **Serverless** | Variable traffic | ⭐⭐⭐ Complex | $70-230 | Full | ✅ |
| **Kubernetes** | Enterprise | ⭐⭐⭐⭐ Very Complex | $300-1000 | Full | ✅ |

**Key Takeaways:**
1. **Same codebase** supports all 4 architectures via environment variables
2. **Event bus abstraction** enables seamless switching between in-memory and Kafka
3. **Storage abstraction** allows using local or GCS without code changes
4. **Deployment mode awareness** ensures workers load correctly
5. **Progressive migration** path from monolith to Kubernetes

---

**Questions? Issues?**
- GitHub: https://github.com/roguezox/storage-system
- Documentation: https://github.com/roguezox/storage-system/tree/main/deployment
