# OpenDrive - Self-Hosted Cloud Storage

<div align="center">

![OpenDrive Logo](https://img.shields.io/badge/OpenDrive-Storage-5E6AD2?style=for-the-badge)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue?style=for-the-badge)](LICENSE)
[![Docker](https://img.shields.io/badge/docker-ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)

**Your files. Your server. No compromises.**

A beautiful, developer-first cloud storage platform that you can self-host on your own infrastructure.  
Zero telemetry, full ownership, and designed with Linear's aesthetic in mind.

[Features](#features) | [Quick Start](#quick-start) | [Architecture](#architecture) | [Deployment](#deployment-options)

</div>

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Deployment Options](#deployment-options)
- [Configuration](#configuration)
- [Storage Backends](#storage-backends)
- [API Documentation](#api-documentation)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Features

### Core Functionality
- **Folder Management** - Create nested folder hierarchies
- **File Upload/Download** - Drag-and-drop with multiple file types
- **Public Sharing** - Generate shareable links with expiration
- **Authentication** - JWT-based secure authentication
- **Multi-User Support** - Isolated storage per user
- **Trash System** - Soft delete with restore capability
- **Search** - Full-text search across files and folders

### Technical Features
- **Docker Native** - Single-command deployment
- **Flexible Storage** - Local disk, GCS, or S3-compatible
- **Modern Stack** - Next.js 16, TypeScript, MongoDB, Express
- **Private by Design** - No analytics, no tracking, no telemetry
- **API First** - RESTful API with comprehensive documentation

---

## Architecture

OpenDrive supports two deployment architectures:

### Monolith (GCP Compute Engine)

Single VM deployment with Docker Compose. Best for small teams and personal use.

```
                                    Internet
                                        |
                                        v
                    +---------------------------------------+
                    |         GCP Compute Engine            |
                    |             (e2-medium)               |
                    |                                       |
                    |   +-------------------------------+   |
                    |   |        Docker Compose         |   |
                    |   |                               |   |
                    |   |   +--------+    +--------+    |   |
                    |   |   |Frontend|    | Backend|    |   |
                    |   |   | :3000  |--->|  :5000 |    |   |
                    |   |   +--------+    +----+---+    |   |
                    |   |                      |        |   |
                    |   |         +------------+        |   |
                    |   |         |                     |   |
                    |   |         v                     |   |
                    |   |   +----------+                |   |
                    |   |   | MongoDB  |                |   |
                    |   |   | (embed)  |                |   |
                    |   |   +----------+                |   |
                    |   +-------------------------------+   |
                    |                 |                     |
                    |                 v (optional)          |
                    |   +-------------------------------+   |
                    |   |       Confluent Cloud         |   |
                    |   |    (Kafka Logging - optional) |   |
                    |   +-------------------------------+   |
                    |                                       |
                    |   Storage: Local Volume or GCS        |
                    +---------------------------------------+

Cost: ~$25-50/month (+ ~$10/mo if Kafka enabled)
Users: Up to 1,000
Setup: 15 minutes
```

**Components:**
- Frontend (Next.js) - User interface
- Backend (Express) - API server
- MongoDB (embedded) - Database with persistent volume
- Kafka (optional) - Centralized logging to Confluent Cloud
- Nginx - Reverse proxy with SSL termination

---

### Kubernetes (GKE)

Microservices architecture with horizontal auto-scaling. Best for production and enterprise.

```
                                    Internet
                                        |
                                        v
    +-------------------------------------------------------------------+
    |                         GKE Cluster                                |
    |                                                                    |
    |   +---------------------------+    +---------------------------+   |
    |   |      Ingress (GCE)        |    |     Load Balancer         |   |
    |   +-------------+-------------+    +-------------+-------------+   |
    |                 |                                |                 |
    |     +-----------+-----------+        +-----------+-----------+     |
    |     v                       v        v                       v     |
    |  +--------+            +--------+  +--------+           +--------+ |
    |  |Frontend|            |  API   |  |  API   |           |Grafana | |
    |  | (2 pod)|            |(2-10)  |  |(2-10)  |           | (1 pod)| |
    |  +--------+            +---+----+  +---+----+           +---+----+ |
    |                            |           |                    ^      |
    |                            +-----------+                    |      |
    |                                  |                          |      |
    |              +-------------------+-------------------+      |      |
    |              |                   |                   |      |      |
    |              v                   v                   v      |      |
    |   +------------------+   +----------------+   +------------+|      |
    |   |  Confluent Kafka |   | Confluent Kafka|   |   Stream   ||      |
    |   |  (Task Events)   |   | (Log Events)   |-->|  Service   |+      |
    |   +--------+---------+   +----------------+   +-----+------+       |
    |            |                                        |              |
    |     +------+------+                                 v              |
    |     |             |                          +------+------+       |
    |     v             v                          |    Loki     |       |
    |  +--------+  +--------+                      | (Log Store) |       |
    |  |Thumbnail|  | Search |                      +-------------+       |
    |  | Worker |  | Worker |                                            |
    |  |(1-5 HPA)| |(1-3 HPA)|                                            |
    |  +--------+  +--------+                                            |
    +-------------------------------------------------------------------+
                    |                               |
                    v                               v
            +---------------+              +---------------+
            | MongoDB Atlas |              | Google Cloud  |
            |    (M10+)     |              |    Storage    |
            +---------------+              +---------------+

Cost: $200-600/month
Users: 10,000+
Setup: 30-45 minutes
```

**Kafka Topics:**
- **Task Events:** `task-thumbnail`, `task-search` → Workers
- **Log Events:** `opendrive-logs-critical/info/debug` → Stream → Loki → Grafana

**Components:**
- **API Gateway** (2-10 pods, HPA) - RESTful API with horizontal scaling
- **Thumbnail Worker** (1-5 pods, HPA) - Async image processing via Kafka
- **Search Worker** (1-3 pods, HPA) - Full-text search indexing via Kafka
- **Frontend** (2 pods) - Next.js application
- **Kafka** - Event bus for workers + centralized logging (Confluent Cloud)
- **Stream Service** - Kafka consumer that pushes logs to Loki
- **Grafana Stack** - Loki for log storage, Grafana for visualization

---

## Quick Start

Get OpenDrive running in under 5 minutes:

```bash
# 1. Clone the repository
git clone https://github.com/roguezox/storage-system.git
cd storage-system

# 2. Create environment file
cp .env.example .env

# 3. Generate JWT secret
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env

# 4. Start with Docker Compose
docker-compose up -d

# 5. Access the application
open http://localhost:3000
```

---

## Deployment Options

| Option | Best For | Cost | Users | Setup Time |
|--------|----------|------|-------|------------|
| **Monolith (GCP VM)** | Personal, small teams | $25-50/mo | 1,000 | 15 min |
| **Kubernetes (GKE)** | Production, enterprise | $200-600/mo | 10,000+ | 45 min |

### Using the Setup Wizard

The easiest way to deploy is using our interactive setup wizard:

1. Visit [opendrive.dev/setup](https://opendrive.dev/setup)
2. Select your architecture (Monolith or Kubernetes)
3. Configure options (storage, MongoDB, Kafka)
4. Download generated scripts
5. Run the deployment script

---

## Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | Secret key for JWT tokens (min 32 chars) | `openssl rand -hex 32` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/opendrive` |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Backend server port |
| `NODE_ENV` | `development` | Environment mode |
| `MAX_FILE_SIZE` | `104857600` | Max upload size (100MB) |
| `STORAGE_PROVIDER` | `local` | Storage backend: `local`, `s3`, or `gcs` |

### MongoDB Options

| Configuration | Description |
|---------------|-------------|
| **Embedded** | MongoDB container with persistent volume (default for Monolith) |
| **External (Atlas)** | MongoDB Atlas M10+ cluster (required for Kubernetes) |

### Kafka Logging (Optional)

| Variable | Description |
|----------|-------------|
| `KAFKA_BOOTSTRAP_SERVERS` | Confluent Cloud bootstrap servers |
| `KAFKA_API_KEY` | Confluent Cloud API key |
| `KAFKA_API_SECRET` | Confluent Cloud API secret |

---

## Storage Backends

### Local Filesystem (Default)

```env
STORAGE_PROVIDER=local
STORAGE_PATH=./uploads
```

### Google Cloud Storage

```env
STORAGE_PROVIDER=gcs
GCS_PROJECT_ID=your-project-id
GCS_BUCKET=your-bucket-name
GCS_KEYFILE=/path/to/keyfile.json
```

### AWS S3 / MinIO

```env
STORAGE_PROVIDER=s3
S3_BUCKET=my-bucket
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_ENDPOINT=https://s3.amazonaws.com  # or MinIO endpoint
```

---

## API Documentation

### Authentication

```http
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

### Folders

```http
GET    /api/folders
POST   /api/folders
GET    /api/folders/:id
PUT    /api/folders/:id
DELETE /api/folders/:id
POST   /api/folders/:id/share
```

### Files

```http
POST   /api/files
GET    /api/files/:id/download
PUT    /api/files/:id
DELETE /api/files/:id
POST   /api/files/:id/share
```

### Public Access

```http
GET /api/public/:shareId
GET /api/public/:shareId/download
```

For complete API documentation, see the [Postman Collection](Storage%20Platform%20API.postman_collection.json).

---

## Development

### Local Development Setup

```bash
# Start MongoDB
docker run -d -p 27017:27017 --name mongodb mongo:7

# Backend
cd backend
npm install
cp .env.example .env
npm run dev  # http://localhost:5000

# Frontend (new terminal)
cd frontend
npm install
npm run dev  # http://localhost:3000
```

### Project Structure

```
storage-system/
├── backend/
│   ├── src/
│   │   ├── config/         # Configuration
│   │   ├── controllers/    # Route handlers
│   │   ├── middleware/     # Express middleware
│   │   ├── models/         # Mongoose models
│   │   ├── routes/         # API routes
│   │   └── storage/        # Storage providers
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/            # Next.js app router
│   │   ├── components/     # React components
│   │   └── lib/            # Utilities
│   └── package.json
├── k8s/                    # Kubernetes manifests
├── stream/                 # Kafka-Loki bridge service
├── docker-compose.yml
└── README.md
```

---

## Troubleshooting

### MongoDB Connection Failed

```
MongooseServerSelectionError: connect ECONNREFUSED
```

**Solutions:**
- Verify MongoDB is running: `docker ps | grep mongodb`
- For Docker: use `mongodb://mongodb:27017` not `localhost`
- Check firewall rules for port 27017

### JWT Authentication Errors

```
401 Unauthorized: JWT must be provided
```

**Solutions:**
- Ensure `JWT_SECRET` is set (min 32 characters)
- Check `Authorization: Bearer <token>` header format
- Token may be expired (default: 7 days)

### File Upload Fails

```
413 Payload Too Large
```

**Solutions:**
- Increase `MAX_FILE_SIZE` in `.env`
- For nginx: add `client_max_body_size 100M;`
- Check available disk space

---

## License

### Open Source Edition

OpenDrive is free software licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

See [LICENSE](LICENSE) for details.

### Enterprise Edition

For commercial licensing with additional features (SSO, audit logs, priority support), see [ENTERPRISE-LICENSE.md](ENTERPRISE-LICENSE.md).

---

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Inspired by [Linear's](https://linear.app/) design
- Icons from [React Icons](https://react-icons.github.io/react-icons/)
