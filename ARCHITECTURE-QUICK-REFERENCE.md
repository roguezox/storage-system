# OpenDrive Architecture Quick Reference

**Fast comparison guide for choosing and understanding deployment architectures**

---

## Architecture Comparison Matrix

| Feature | Monolith | Docker + Kafka | Serverless | Kubernetes |
|---------|----------|----------------|------------|------------|
| **Setup Time** | 5 minutes | 15 minutes | 20 minutes | 25 minutes |
| **Monthly Cost (Low)** | $0-10 | $100 | $70 | $325 |
| **Monthly Cost (High)** | $50 | $100 | $230 | $975 |
| **User Capacity** | 100-1K | 1K-5K | 5K-15K | 10K+ |
| **Scaling Method** | Manual (vertical) | Limited (horizontal) | Full auto (0-1000) | Full auto (HPA) |
| **High Availability** | ❌ No | ⚠️ Limited | ✅ Yes | ✅ Yes |
| **Self-Healing** | ❌ No | ❌ No | ✅ Yes | ✅ Yes |
| **Cold Start** | ❌ N/A | ❌ N/A | ⚠️ ~500ms | ❌ N/A |
| **Zero Downtime Updates** | ❌ No | ⚠️ Manual | ✅ Yes | ✅ Yes |
| **Multi-Zone** | ❌ No | ❌ No | ✅ Yes | ✅ Yes |
| **Worker Scaling** | ❌ Embedded | ⚠️ Limited | ✅ Independent | ✅ Independent |
| **Event Bus** | In-Memory | Kafka | Kafka | Kafka |
| **MongoDB** | Embedded | Embedded/Atlas | Atlas Required | Atlas Required |
| **Storage** | Local/GCS | Local/GCS | GCS Required | GCS Required |
| **Load Balancer** | ❌ No | ✅ Nginx | ✅ GCP LB | ✅ GCP LB |
| **Logging** | Console | Kafka→Loki→Grafana | Kafka→Loki | Stackdriver+Kafka |
| **DevOps Complexity** | ⭐ Very Simple | ⭐⭐ Moderate | ⭐⭐⭐ Complex | ⭐⭐⭐⭐ Very Complex |
| **Best For** | Dev/Personal | Growing Startups | Variable Traffic | Enterprise |

---

## Architecture 1: Monolith (Docker Compose)

### Quick Overview
```
┌─────────────────────┐
│   Docker Compose    │
│  ┌────────────────┐ │
│  │ Backend        │ │ ← Workers embedded (same process)
│  │ + Workers      │ │
│  └────────────────┘ │
│  ┌────────────────┐ │
│  │ Frontend       │ │
│  └────────────────┘ │
│  ┌────────────────┐ │
│  │ MongoDB        │ │
│  └────────────────┘ │
└─────────────────────┘
```

### Key Characteristics
- **Workers:** Embedded in backend process
- **Event Bus:** Node.js EventEmitter (in-memory)
- **Database:** Docker MongoDB container
- **Storage:** Local filesystem (Docker volume)
- **Scaling:** Vertical only (upgrade VM)

### Configuration
```bash
DEPLOYMENT_MODE=monolith
MONGODB_URI=mongodb://admin:pass@mongodb:27017/drive
STORAGE_PROVIDER=local
KAFKA_ENABLED=false
```

### When to Choose
- ✅ Local development
- ✅ Personal projects
- ✅ Small teams (<10 users)
- ✅ Budget: $0-50/month
- ✅ Learning/prototyping
- ❌ Production with >1K users
- ❌ Need high availability
- ❌ Distributed teams

### Deployment
```bash
# Download from setup wizard or manually
docker-compose up -d

# Access
# Frontend: http://localhost:3000
# Backend: http://localhost:5000
```

---

## Architecture 2: Docker + Kafka (VM)

### Quick Overview
```
┌──────────────────────────────────────┐
│        GCP Compute Engine VM         │
│  ┌──────────────────────────────┐   │
│  │ Nginx Load Balancer          │   │
│  └─────┬────────────┬───────────┘   │
│        │            │                │
│  ┌─────▼───┐  ┌────▼────┐          │
│  │ API-1   │  │ API-2   │          │
│  └─────────┘  └─────────┘          │
│                                      │
│  ┌───────────────────────────────┐  │
│  │ Standalone Workers            │  │
│  │ • Thumbnail                   │  │
│  │ • Search                      │  │
│  └───────────────────────────────┘  │
│                                      │
│  ┌───────────────────────────────┐  │
│  │ Logging Stack                 │  │
│  │ • Log Service (Kafka→Loki)    │  │
│  │ • Grafana Dashboard           │  │
│  └───────────────────────────────┘  │
│                                      │
│  ┌───────────────────────────────┐  │
│  │ MongoDB (Persistent)          │  │
│  └───────────────────────────────┘  │
└──────────────────────────────────────┘
          │
          ▼
    Confluent Cloud Kafka
```

### Key Characteristics
- **Workers:** Standalone containers (separate processes)
- **Event Bus:** Kafka (Confluent Cloud)
- **Database:** Docker MongoDB or Atlas
- **Storage:** GCS or S3 recommended
- **Scaling:** Horizontal (limited by VM)
- **Load Balancer:** Nginx

### Configuration
```bash
DEPLOYMENT_MODE=microservices
SERVICE_NAME=api  # or thumbnail-worker, search-worker
KAFKA_ENABLED=true
KAFKA_BOOTSTRAP_SERVERS=pkc-xxx.confluent.cloud:9092
KAFKA_API_KEY=your-key
KAFKA_API_SECRET=your-secret
KAFKA_GROUP_ID=api-group  # Per worker type
STORAGE_PROVIDER=gcs
GCS_BUCKET=opendrive-files
```

### When to Choose
- ✅ Growing past monolith limits (1K-5K users)
- ✅ Need logging and monitoring
- ✅ Want event-driven architecture
- ✅ Budget: ~$100/month
- ✅ Not ready for full Kubernetes
- ❌ >5K concurrent users (VM maxes out)
- ❌ Need true auto-scaling
- ❌ Multi-region deployments

### Deployment
```bash
# Deploy to GCP VM
chmod +x deploy-hybrid-gcp.sh
./deploy-hybrid-gcp.sh

# Access
# Frontend: http://VM_IP:3000
# Backend: http://VM_IP:5000 (load balanced)
# Grafana: http://VM_IP:3001
```

### Scaling
```bash
# Scale API instances
docker-compose up -d --scale api-1=3 --scale api-2=3

# Scale workers (Kafka handles distribution)
docker-compose up -d --scale thumbnail-worker=5

# Upgrade VM size
gcloud compute instances stop opendrive-vm
gcloud compute instances set-machine-type opendrive-vm \
  --machine-type=e2-standard-8
gcloud compute instances start opendrive-vm
```

---

## Architecture 3: Serverless (Cloud Run)

### Quick Overview
```
          Internet
              │
              ▼
    ┌─────────────────┐
    │ GCP Load Bal.   │
    └────┬────┬───┬───┘
         │    │   │
    ┌────▼┐ ┌─▼─┐│┌──▼───┐
    │API  │ │Thumb││Search│
    │0-10 │ │0-5  ││0-3   │
    │inst.│ │inst.││inst. │
    └─────┘ └────┘│└──────┘
         │    │   │
         └────┴───┴─────────┐
                            ▼
              ┌─────────────────────────┐
              │ External Services       │
              │ • MongoDB Atlas         │
              │ • Confluent Kafka       │
              │ • Google Cloud Storage  │
              └─────────────────────────┘
```

### Key Characteristics
- **Workers:** Independent Cloud Run services
- **Event Bus:** Kafka (Confluent Cloud)
- **Database:** MongoDB Atlas (required)
- **Storage:** Google Cloud Storage (required)
- **Scaling:** True auto-scaling (0-1000 per service)
- **Load Balancer:** GCP Load Balancer (automatic)

### Configuration
```bash
DEPLOYMENT_MODE=microservices
SERVICE_NAME=api  # Different per service
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/drive
STORAGE_PROVIDER=gcs
GCS_PROJECT_ID=my-project
GCS_BUCKET=opendrive-files
KAFKA_ENABLED=true
KAFKA_BOOTSTRAP_SERVERS=pkc-xxx.confluent.cloud:9092
```

### When to Choose
- ✅ Variable/unpredictable traffic
- ✅ 5K-15K concurrent users
- ✅ Want zero infrastructure management
- ✅ Budget: $70-230/month
- ✅ Pay-per-use model (scales to zero)
- ✅ Global CDN needed
- ❌ Need <100ms latency (cold starts)
- ❌ Persistent connections (WebSockets)
- ❌ Stateful workloads

### Deployment
```bash
# Deploy all services
chmod +x deploy-serverless-cloudrun.sh
./deploy-serverless-cloudrun.sh

# Access
# Frontend: https://opendrive-frontend-xxx.a.run.app
# API: https://opendrive-api-xxx.a.run.app
```

### Scaling Behavior
```
Service: API
│
├─> 0 requests → 0 instances (no cost)
├─> 10 req/sec → 1 instance spins up (~500ms cold start)
├─> 100 req/sec → 2-3 instances
├─> 500 req/sec → 7-10 instances (max)
└─> Idle 15 min → Scale to 0 again
```

### Cost Example (Monthly)
| Traffic | Cloud Run | Atlas | Kafka | Total |
|---------|-----------|-------|-------|-------|
| Idle | $0 | $60 | $10 | **$70** |
| Light (1K users) | $30 | $60 | $10 | **$100** |
| Medium (5K users) | $80 | $60 | $20 | **$160** |
| Heavy (10K users) | $150 | $60 | $20 | **$230** |

---

## Architecture 4: Kubernetes (GKE)

### Quick Overview
```
          Internet
              │
              ▼
    ┌─────────────────┐
    │ GCP Load Bal.   │
    └────────┬────────┘
             │
    ┌────────▼────────────────────┐
    │    GKE Ingress Controller    │
    └────────┬────────────────────┘
             │
    ┌────────▼────────────────────────────┐
    │   GKE Cluster (2-10 nodes)          │
    │                                     │
    │  ┌──────────────────────────────┐  │
    │  │ API Deployment               │  │
    │  │ ┌───┐ ┌───┐ ┌───┐ ┌───┐    │  │
    │  │ │P1 │ │P2 │ │P3 │ │P4 │    │  │
    │  │ └───┘ └───┘ └───┘ └───┘    │  │
    │  │ Replicas: 2-10 (HPA)        │  │
    │  └──────────────────────────────┘  │
    │                                     │
    │  ┌──────────────────────────────┐  │
    │  │ Worker Deployments           │  │
    │  │ • Thumbnail: 1-5 pods        │  │
    │  │ • Search: 1-3 pods           │  │
    │  └──────────────────────────────┘  │
    │                                     │
    │  ┌──────────────────────────────┐  │
    │  │ Frontend: 2 pods             │  │
    │  └──────────────────────────────┘  │
    └─────────────────────────────────────┘
```

### Key Characteristics
- **Workers:** Kubernetes Deployments with HPA
- **Event Bus:** Kafka (Confluent Cloud)
- **Database:** MongoDB Atlas (required)
- **Storage:** Google Cloud Storage (required)
- **Scaling:** Full auto-scaling (pods + nodes)
- **Load Balancer:** GCP Load Balancer + Ingress

### Configuration
```yaml
# Kubernetes Secret
apiVersion: v1
kind: Secret
metadata:
  name: opendrive-secrets
type: Opaque
stringData:
  mongodb-uri: "mongodb+srv://..."
  jwt-secret: "your-secret"
  kafka-bootstrap-servers: "pkc-xxx.confluent.cloud:9092"
  kafka-api-key: "your-key"
  kafka-api-secret: "your-secret"
```

### When to Choose
- ✅ Production workloads at scale (10K+ users)
- ✅ Need 99.9%+ uptime SLA
- ✅ Have DevOps expertise
- ✅ Complex multi-service applications
- ✅ Compliance requirements (PCI, HIPAA, SOC 2)
- ✅ Budget: $300-1000/month
- ❌ Small projects (<1K users)
- ❌ No Kubernetes experience
- ❌ Want zero ops overhead

### Deployment
```bash
# Deploy GKE cluster
chmod +x deploy-gke-kubernetes.sh
./deploy-gke-kubernetes.sh

# Access
# Frontend: http://LOAD_BALANCER_IP
# API: http://LOAD_BALANCER_IP/api
```

### Scaling Behavior

**Pod-Level (HPA):**
```
API Deployment:
├─> CPU > 70% → Scale up
├─> Memory > 80% → Scale up
├─> Current: 2 pods, Target: 4 pods
└─> Scales immediately (no cold start)
```

**Node-Level (Cluster Autoscaler):**
```
Cluster:
├─> Pods pending (no space) → Add node
├─> Node under-utilized >10min → Remove node
├─> Current: 2 nodes, Max: 10 nodes
└─> Node provision time: ~90 seconds
```

### Management Commands
```bash
# View pods
kubectl get pods -n opendrive

# View logs
kubectl logs -f deployment/opendrive-api -n opendrive

# Scale manually (overrides HPA)
kubectl scale deployment opendrive-api --replicas=5 -n opendrive

# Update image (rolling update)
kubectl set image deployment/opendrive-api \
  api=gcr.io/PROJECT_ID/opendrive-api:v2 -n opendrive

# View autoscaler status
kubectl get hpa -n opendrive

# Delete everything
kubectl delete namespace opendrive
```

### Cost Breakdown (Monthly)
| Component | Min | Max |
|-----------|-----|-----|
| GKE Control Plane | $75 | $75 |
| Worker Nodes (2-10) | $150 | $750 |
| Load Balancer | $20 | $20 |
| Persistent Disks | $10 | $50 |
| MongoDB Atlas | $60 | $60 |
| Confluent Kafka | $10 | $20 |
| Egress (1TB) | $120 | $120 |
| **Total** | **$445** | **$1,095** |

**Cost Optimization:**
- Use Preemptible VMs: Save 80% (reduce node cost from $75 to $15)
- Committed use discounts: Save 57% with 3-year commit
- Regional cluster: Better HA, same cost

---

## Key Technical Differences

### Event Bus

| Architecture | Implementation | Delivery | Durability |
|--------------|----------------|----------|------------|
| Monolith | Node.js EventEmitter | Synchronous | None (in-memory) |
| Docker + Kafka | Kafka Consumer Groups | Asynchronous | Persistent (days) |
| Serverless | Kafka Consumer Groups | Asynchronous | Persistent (days) |
| Kubernetes | Kafka Consumer Groups | Asynchronous | Persistent (days) |

### Worker Execution

| Architecture | Workers | Process | Scaling |
|--------------|---------|---------|---------|
| Monolith | Embedded | Same PID as API | No (vertical only) |
| Docker + Kafka | Standalone | Separate containers | Yes (via docker-compose) |
| Serverless | Standalone | Cloud Run services | Yes (auto 0-1000) |
| Kubernetes | Standalone | Kubernetes Pods | Yes (HPA 1-N) |

### Storage

| Architecture | Recommended | Why |
|--------------|-------------|-----|
| Monolith | Local | Simple, no external deps |
| Docker + Kafka | GCS | Shared across API instances |
| Serverless | GCS | Required (no local disk) |
| Kubernetes | GCS | Required (no local disk) |

### MongoDB

| Architecture | Options | Default |
|--------------|---------|---------|
| Monolith | Embedded Docker or Atlas | Embedded |
| Docker + Kafka | Embedded Docker or Atlas | Embedded |
| Serverless | Atlas only | Atlas (required) |
| Kubernetes | Atlas only | Atlas (required) |

---

## Decision Tree

```
Start Here
    │
    ├─> Budget < $50/month?
    │   └─> YES → Monolith
    │
    ├─> Need auto-scaling?
    │   │
    │   ├─> NO → Docker + Kafka (VM)
    │   │
    │   └─> YES
    │       │
    │       ├─> Variable traffic?
    │       │   └─> YES → Serverless
    │       │
    │       └─> Steady high traffic?
    │           └─> YES → Kubernetes
    │
    └─> Need 99.9%+ uptime?
        └─> YES → Kubernetes
```

---

## Migration Paths

### Progressive Scaling
```
Monolith ($0-50/mo)
    ↓
    When hit 500-1K users
    ↓
Docker + Kafka ($100/mo)
    ↓
    When traffic becomes variable
    ↓
Serverless ($70-230/mo)
```

### Enterprise Path
```
Monolith (Dev)
    ↓
    Directly to production
    ↓
Kubernetes ($300-1000/mo)
```

### Downtime During Migration

| From → To | Downtime | Complexity |
|-----------|----------|------------|
| Monolith → Docker+Kafka | 15-30 min | Moderate |
| Docker+Kafka → Serverless | 5 min | Low |
| Serverless → Kubernetes | 0 min | Low (blue-green) |
| Any → Any | Can be 0 min | High (requires planning) |

---

## Quick Reference Commands

### Monolith
```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# Logs
docker-compose logs -f backend

# Update
docker-compose pull && docker-compose up -d
```

### Docker + Kafka
```bash
# Start
docker-compose -f docker-compose.hybrid.yml up -d

# Scale API
docker-compose up -d --scale api-1=3

# Scale workers
docker-compose up -d --scale thumbnail-worker=5

# Logs
docker logs -f opendrive-api-1
docker logs -f opendrive-thumbnail-worker
```

### Serverless
```bash
# Deploy
./deploy-serverless-cloudrun.sh

# View services
gcloud run services list

# View logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=opendrive-api"

# Update image
gcloud run deploy opendrive-api --image gcr.io/PROJECT/opendrive-api:v2
```

### Kubernetes
```bash
# Deploy
./deploy-gke-kubernetes.sh

# View pods
kubectl get pods -n opendrive

# View services
kubectl get svc -n opendrive

# Logs
kubectl logs -f deployment/opendrive-api -n opendrive

# Scale
kubectl scale deployment opendrive-api --replicas=5 -n opendrive

# Update
kubectl set image deployment/opendrive-api api=gcr.io/PROJECT/api:v2 -n opendrive

# Rollback
kubectl rollout undo deployment/opendrive-api -n opendrive
```

---

## Environment Variables Cheat Sheet

### Required for All
```bash
MONGODB_URI=<connection-string>
JWT_SECRET=<32-char-secret>
NODE_ENV=production
PORT=5000
```

### Microservices (Docker+Kafka, Serverless, Kubernetes)
```bash
DEPLOYMENT_MODE=microservices
SERVICE_NAME=api|thumbnail-worker|search-worker
KAFKA_ENABLED=true
KAFKA_BOOTSTRAP_SERVERS=pkc-xxx.confluent.cloud:9092
KAFKA_API_KEY=<your-key>
KAFKA_API_SECRET=<your-secret>
KAFKA_GROUP_ID=<group-name>
```

### Cloud Storage
```bash
STORAGE_PROVIDER=gcs|s3|local
GCS_PROJECT_ID=<project>
GCS_BUCKET=<bucket-name>
S3_BUCKET=<bucket-name>
S3_REGION=us-east-1
```

---

## Health Check Endpoints

### All Architectures
```bash
# API health
curl http://API_HOST:5000/api/health
# Response: { "status": "ok", "timestamp": "..." }

# Frontend health
curl http://FRONTEND_HOST:3000/
# Response: 200 OK (HTML)
```

### Docker + Kafka
```bash
# Check Grafana
curl http://VM_IP:3001/api/health
# Response: { "commit": "...", "database": "ok", ... }
```

### Kubernetes
```bash
# Liveness probe
curl http://POD_IP:5000/api/health

# Readiness probe
curl http://POD_IP:5000/api/health
```

---

## Troubleshooting Quick Reference

### Monolith
```bash
# MongoDB not connecting
docker ps | grep mongodb
docker logs opendrive-db

# Backend crashes
docker logs opendrive-api
docker-compose restart backend
```

### Docker + Kafka
```bash
# Worker not processing
docker logs opendrive-thumbnail-worker
# Check Kafka consumer lag

# Nginx routing issues
docker logs opendrive-nginx
# Check nginx.conf
```

### Serverless
```bash
# Cold starts
gcloud run services update opendrive-api --min-instances 1

# View logs
gcloud logging read "resource.type=cloud_run_revision"

# Check quota
gcloud run services describe opendrive-api --format=yaml
```

### Kubernetes
```bash
# Pod not starting
kubectl describe pod POD_NAME -n opendrive
kubectl logs POD_NAME -n opendrive

# Service not routing
kubectl get endpoints -n opendrive
kubectl describe svc opendrive-api-service -n opendrive

# HPA not scaling
kubectl get hpa -n opendrive
kubectl describe hpa opendrive-api-hpa -n opendrive
```

---

## Additional Resources

- **Full Architecture Deep Dive:** [ARCHITECTURE-DEEP-DIVE.md](./ARCHITECTURE-DEEP-DIVE.md)
- **Deployment Options Guide:** [DEPLOYMENT-OPTIONS.md](./DEPLOYMENT-OPTIONS.md)
- **Setup Wizard:** https://opendrive.dev/setup
- **Repository:** https://github.com/roguezox/storage-system

---

**Last Updated:** January 2025
