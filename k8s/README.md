# OpenDrive Kubernetes Microservices Deployment

Complete Kubernetes deployment with microservices architecture featuring separate worker pods, horizontal pod autoscaling, and nginx ingress.

## Architecture Overview

```
┌────────────────────────────────────────────────────────────┐
│              Internet Traffic (External)                   │
└───────────────────┬────────────────────────────────────────┘
                    │
                    ▼
        ┌────────────────────────┐
        │ GCP Load Balancer      │
        │ (Automatic)            │
        └────────────┬───────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │ Kubernetes Ingress     │
        │ /api/* → API Service   │
        │ /*     → Frontend      │
        └────────────┬───────────┘
                     │
        ┌────────────┴─────────────────┐
        │                              │
        ▼                              ▼
┌──────────────────┐       ┌──────────────────────┐
│ API Service      │       │ Frontend Service     │
│ (ClusterIP)      │       │ (LoadBalancer)       │
└────────┬─────────┘       └──────────┬───────────┘
         │                             │
    ┌────┴────┬────────────┐          │
    ▼         ▼            ▼          ▼
┌─────────┐┌─────────┐┌─────────┐┌──────────┐
│API Pod 1││API Pod 2││API Pod N││Frontend 1│
│:5000    ││:5000    ││:5000    ││:3000     │
└─────────┘└─────────┘└─────────┘└──────────┘
 2-10 pods (HPA)                   2 pods

Worker Pods (Separate Deployments):
┌──────────────────┐  ┌──────────────────┐
│Thumbnail Worker  │  │Search Worker     │
│  ┌────────────┐  │  │  ┌────────────┐  │
│  │Worker Pod 1│  │  │  │Worker Pod 1│  │
│  └────────────┘  │  │  └────────────┘  │
│  1-5 pods (HPA)  │  │  1-3 pods (HPA)  │
└──────────────────┘  └──────────────────┘
```

### Key Features

- **Microservices Architecture**: API, thumbnail worker, and search worker run as separate deployments
- **Horizontal Pod Autoscaling (HPA)**: Automatic scaling based on CPU/Memory
  - API: 2-10 pods
  - Thumbnail Worker: 1-5 pods
  - Search Worker: 1-3 pods
- **Event-Driven Communication**: Workers consume events from Kafka
- **Self-Healing**: Automatic pod restarts on failure
- **Rolling Updates**: Zero-downtime deployments
- **Load Balancing**: Automatic load balancing across pods
- **Health Checks**: Liveness and readiness probes

## Prerequisites

### Required Software

1. **gcloud CLI**
   ```bash
   # Install: https://cloud.google.com/sdk/docs/install
   gcloud --version
   ```

2. **kubectl**
   ```bash
   # Install: https://kubernetes.io/docs/tasks/tools/
   kubectl version --client
   ```

3. **GKE Auth Plugin** (REQUIRED)
   ```bash
   # Linux/Ubuntu
   sudo apt-get install -y google-cloud-sdk-gke-gcloud-auth-plugin

   # macOS/Other
   gcloud components install gke-gcloud-auth-plugin

   # Verify
   gke-gcloud-auth-plugin --version
   ```

4. **Docker**
   ```bash
   # Install: https://docs.docker.com/get-docker/
   docker --version
   ```

### Required Services

1. **MongoDB Atlas** (REQUIRED)
   - Create account: https://www.mongodb.com/cloud/atlas/register
   - Create M10+ cluster ($57/month)
   - Get connection string: `mongodb+srv://user:password@cluster.mongodb.net/opendrive`
   - Why required: Kubernetes pods scale horizontally; embedded MongoDB would create isolated databases per pod

2. **Confluent Cloud Kafka** (OPTIONAL but recommended)
   - Create account: https://confluent.cloud/signup
   - Create Basic cluster (~$10-50/month)
   - Create topics:
     - `opendrive-logs-critical`
     - `opendrive-logs-info`
     - `opendrive-logs-debug`
   - Generate API credentials

3. **GCP Project**
   - Create project: https://console.cloud.google.com/
   - Enable billing
   - Note your PROJECT_ID

## Quick Start Deployment

### 1. Set Environment Variables

```bash
# Required Configuration
export GCP_PROJECT_ID="your-gcp-project-id"
export GCP_REGION="us-central1"
export GITHUB_USERNAME="your-github-username"

# MongoDB Atlas (REQUIRED)
export MONGODB_URI="mongodb+srv://user:password@cluster.mongodb.net/opendrive?retryWrites=true"

# Security (auto-generated if not set)
export JWT_SECRET="your-32-character-random-secret"

# Google Cloud Storage
export GCS_BUCKET="opendrive-files"  # Will be created automatically

# Kafka (OPTIONAL)
export KAFKA_ENABLED="true"
export KAFKA_BOOTSTRAP_SERVERS="pkc-xxxxx.us-central1.gcp.confluent.cloud:9092"
export KAFKA_API_KEY="your-confluent-api-key"
export KAFKA_API_SECRET="your-confluent-api-secret"
```

### 2. Run Deployment Script

```bash
chmod +x deploy-gke-microservices.sh
./deploy-gke-microservices.sh
```

The script will:
1. ✓ Verify prerequisites
2. ✓ Configure GCP project
3. ✓ Create GCS bucket and service account
4. ✓ Create GKE cluster (2 nodes, autoscaling to 10)
5. ✓ Clone repository and build Docker images
6. ✓ Push images to Google Container Registry
7. ✓ Deploy all Kubernetes manifests
8. ✓ Configure secrets and ConfigMaps
9. ✓ Wait for all pods to be ready
10. ✓ Output access URLs

**Estimated time**: 10-15 minutes

### 3. Access Your Application

Once deployed, the script will output:

```
Frontend URL: http://35.123.45.67
Backend API:  http://35.123.45.67/api
```

## Kubernetes Manifests

### Manifest Files

| File | Description |
|------|-------------|
| `00-namespace.yaml` | Creates `opendrive` namespace |
| `01-secrets.yaml` | Template for secrets (replaced by script) |
| `02-configmap.yaml` | Shared environment variables |
| `03-api-deployment.yaml` | API deployment + service + HPA (2-10 pods) |
| `04-thumbnail-worker-deployment.yaml` | Thumbnail worker + HPA (1-5 pods) |
| `05-search-worker-deployment.yaml` | Search worker + HPA (1-3 pods) |
| `06-frontend-deployment.yaml` | Frontend deployment + LoadBalancer service |
| `07-ingress.yaml` | Ingress routing configuration |

### Apply Manifests Manually

If you want to apply manifests manually instead of using the script:

```bash
# 1. Update manifests with your PROJECT_ID
sed -i 's/PROJECT_ID/your-project-id/g' k8s/*.yaml

# 2. Create namespace
kubectl apply -f k8s/00-namespace.yaml

# 3. Create secrets
kubectl create secret generic opendrive-secrets \
  --from-literal=mongodb-uri="mongodb+srv://..." \
  --from-literal=jwt-secret="your-secret" \
  --from-literal=gcs-project-id="your-project" \
  --from-literal=gcs-bucket="opendrive-files" \
  --namespace=opendrive

# 4. Apply all manifests
kubectl apply -f k8s/02-configmap.yaml
kubectl apply -f k8s/03-api-deployment.yaml
kubectl apply -f k8s/04-thumbnail-worker-deployment.yaml
kubectl apply -f k8s/05-search-worker-deployment.yaml
kubectl apply -f k8s/06-frontend-deployment.yaml
kubectl apply -f k8s/07-ingress.yaml

# 5. Check deployment status
kubectl get pods -n opendrive
kubectl get svc -n opendrive
kubectl get hpa -n opendrive
```

## Horizontal Pod Autoscaler (HPA)

### API Service HPA

- **Min Replicas**: 2
- **Max Replicas**: 10
- **Target CPU**: 70%
- **Target Memory**: 80%
- **Scale Up**: Immediate (0s stabilization)
- **Scale Down**: 5 minutes stabilization

```bash
# View HPA status
kubectl get hpa opendrive-api-hpa -n opendrive

# Example output:
# NAME                 REFERENCE               TARGETS   MINPODS   MAXPODS   REPLICAS
# opendrive-api-hpa    Deployment/opendrive-api  45%/70%   2         10        3
```

### Thumbnail Worker HPA

- **Min Replicas**: 1
- **Max Replicas**: 5
- **Target CPU**: 70%
- **Target Memory**: 80%

### Search Worker HPA

- **Min Replicas**: 1
- **Max Replicas**: 3
- **Target CPU**: 70%
- **Target Memory**: 80%

## Useful Commands

### View Resources

```bash
# All pods in opendrive namespace
kubectl get pods -n opendrive

# All services
kubectl get svc -n opendrive

# HPA status
kubectl get hpa -n opendrive

# Ingress configuration
kubectl get ingress -n opendrive

# Deployments
kubectl get deployments -n opendrive
```

### View Logs

```bash
# API pods logs
kubectl logs -l app=opendrive-api -n opendrive -f

# Thumbnail worker logs
kubectl logs -l app=opendrive-thumbnail-worker -n opendrive -f

# Search worker logs
kubectl logs -l app=opendrive-search-worker -n opendrive -f

# Frontend logs
kubectl logs -l app=opendrive-frontend -n opendrive -f

# All worker logs
kubectl logs -l tier=worker -n opendrive -f
```

### Scaling

```bash
# Manual scaling (overrides HPA temporarily)
kubectl scale deployment opendrive-api --replicas=5 -n opendrive

# Scale workers
kubectl scale deployment opendrive-thumbnail-worker --replicas=3 -n opendrive
kubectl scale deployment opendrive-search-worker --replicas=2 -n opendrive

# View current replica count
kubectl get deployments -n opendrive
```

### Debugging

```bash
# Describe pod (shows events, status)
kubectl describe pod POD_NAME -n opendrive

# Execute command in pod
kubectl exec -it POD_NAME -n opendrive -- /bin/sh

# Port forward for local testing
kubectl port-forward svc/opendrive-api-service 5000:80 -n opendrive

# View pod resource usage
kubectl top pods -n opendrive

# View node resource usage
kubectl top nodes
```

### Updates and Rollbacks

```bash
# Update image (rolling update)
kubectl set image deployment/opendrive-api \
  api=gcr.io/PROJECT_ID/opendrive-backend:v2 \
  -n opendrive

# Check rollout status
kubectl rollout status deployment/opendrive-api -n opendrive

# View rollout history
kubectl rollout history deployment/opendrive-api -n opendrive

# Rollback to previous version
kubectl rollout undo deployment/opendrive-api -n opendrive

# Rollback to specific revision
kubectl rollout undo deployment/opendrive-api --to-revision=3 -n opendrive
```

## Cost Estimation

### Monthly Costs

| Component | Configuration | Cost |
|-----------|---------------|------|
| **GKE Cluster** | 2-10 e2-standard-4 nodes | $150-750 |
| **Load Balancer** | 1 global LB | $20 |
| **GCS Storage** | 100GB | $2 |
| **Egress** | 1TB | $120 |
| **MongoDB Atlas** | M10 cluster | $57 |
| **Kafka (optional)** | Confluent Basic | $10-50 |
| **Total** | | **$359-999/month** |

### Cost Optimization Tips

1. **Use Preemptible VMs** (save 80%)
   ```bash
   --preemptible
   ```
   Risk: Pods may be terminated with 30s notice

2. **Reduce node size** for dev/staging
   ```bash
   --machine-type=e2-medium  # $24/month instead of $75
   ```

3. **Lower min replicas**
   ```yaml
   minReplicas: 1  # Instead of 2
   ```

4. **Use committed use discounts** (save 57%)
   - Purchase 1-year or 3-year commitment

## Monitoring and Observability

### GCP Console

View cluster metrics in GCP Console:
- **Workloads**: https://console.cloud.google.com/kubernetes/workload
- **Services**: https://console.cloud.google.com/kubernetes/discovery
- **Logs**: https://console.cloud.google.com/logs

### kubectl Built-in

```bash
# Resource usage
kubectl top pods -n opendrive
kubectl top nodes

# Events
kubectl get events -n opendrive --sort-by='.lastTimestamp'
```

### Optional: Prometheus + Grafana

Deploy Prometheus and Grafana for advanced monitoring:

```bash
# Add Prometheus Helm repo
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install Prometheus + Grafana
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace

# Access Grafana
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80
# Visit: http://localhost:3000 (admin/prom-operator)
```

## Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl get pods -n opendrive

# Describe pod to see events
kubectl describe pod POD_NAME -n opendrive

# Common issues:
# - Image pull errors: Check GCR permissions
# - CrashLoopBackOff: Check logs with kubectl logs
# - Pending: Check node resources with kubectl top nodes
```

### Cannot Access Application

```bash
# Check LoadBalancer service
kubectl get svc opendrive-frontend-service -n opendrive

# If EXTERNAL-IP is <pending>:
# Wait 2-3 minutes for GCP to provision the load balancer

# Check ingress
kubectl get ingress -n opendrive
kubectl describe ingress opendrive-ingress -n opendrive
```

### HPA Not Scaling

```bash
# Check HPA status
kubectl get hpa -n opendrive

# If TARGETS shows <unknown>:
# Metrics server may not be installed
kubectl top pods -n opendrive

# Install metrics server if needed
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

### Workers Not Processing Events

```bash
# Check worker logs
kubectl logs -l tier=worker -n opendrive

# Verify Kafka connectivity
kubectl exec -it POD_NAME -n opendrive -- env | grep KAFKA

# Check secrets
kubectl get secret opendrive-secrets -n opendrive -o yaml
```

## Cleanup

### Delete Entire Deployment

```bash
# Delete all resources in namespace
kubectl delete namespace opendrive

# Delete GKE cluster
gcloud container clusters delete opendrive-cluster --zone=us-central1-a

# Delete GCS bucket (WARNING: deletes all files)
gsutil rm -r gs://opendrive-files

# Delete service account
gcloud iam service-accounts delete opendrive-storage@PROJECT_ID.iam.gserviceaccount.com
```

### Delete Specific Resources

```bash
# Delete workers only
kubectl delete deployment opendrive-thumbnail-worker -n opendrive
kubectl delete deployment opendrive-search-worker -n opendrive

# Delete API only
kubectl delete deployment opendrive-api -n opendrive
kubectl delete svc opendrive-api-service -n opendrive

# Delete HPA
kubectl delete hpa opendrive-api-hpa -n opendrive
```

## Advanced Configuration

### Custom Domain with SSL/TLS

1. **Reserve static IP**
   ```bash
   gcloud compute addresses create opendrive-ip --global
   ```

2. **Update ingress annotation**
   ```yaml
   annotations:
     kubernetes.io/ingress.global-static-ip-name: "opendrive-ip"
   ```

3. **Point your domain DNS to the IP**
   ```bash
   gcloud compute addresses describe opendrive-ip --global
   ```

4. **Install cert-manager**
   ```bash
   kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
   ```

5. **Create ClusterIssuer and update Ingress**
   See: https://cert-manager.io/docs/tutorials/acme/http01/

### Multi-Region Deployment

For high availability across regions:

1. Create regional cluster instead of zonal
   ```bash
   --region=us-central1  # Instead of --zone=us-central1-a
   ```

2. Enable multi-region GCS
   ```bash
   --location=us  # Instead of --location=us-central1
   ```

3. Use MongoDB Atlas multi-region replica set

## Support and Documentation

- **GitHub Issues**: https://github.com/YOUR_USERNAME/storage-system/issues
- **Kubernetes Docs**: https://kubernetes.io/docs/
- **GKE Docs**: https://cloud.google.com/kubernetes-engine/docs
- **Architecture Guide**: See main repository README

## License

See LICENSE file in main repository.
