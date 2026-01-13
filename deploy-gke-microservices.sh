#!/bin/bash
# =======================================================================
# OpenDrive Kubernetes Microservices Deployment Script
# GKE with separate worker pods and nginx ingress
# =======================================================================
#
# This script deploys OpenDrive to Google Kubernetes Engine (GKE) with:
# - API Gateway (2-10 pods with HPA)
# - Thumbnail Worker (1-5 pods with HPA)
# - Search Worker (1-3 pods with HPA)
# - Frontend (2 pods)
# - nginx Ingress Controller
# - MongoDB Atlas (external)
# - Confluent Kafka for event streaming
# - Google Cloud Storage for files
#
# Architecture: Microservices with separate worker pods
# =======================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration Variables (MODIFY THESE)
PROJECT_ID="${GCP_PROJECT_ID:-YOUR_PROJECT_ID}"
REGION="${GCP_REGION:-us-central1}"
CLUSTER_NAME="opendrive-cluster"
GITHUB_USERNAME="${GITHUB_USERNAME:-YOUR_GITHUB_USERNAME}"

# MongoDB Atlas Configuration (REQUIRED)
MONGODB_URI="${MONGODB_URI:-}"

# Security Configuration (REQUIRED)
JWT_SECRET="${JWT_SECRET:-}"

# Google Cloud Storage Configuration (REQUIRED)
GCS_BUCKET="${GCS_BUCKET:-opendrive-files}"
GCS_PROJECT_ID="${GCS_PROJECT_ID:-$PROJECT_ID}"

# Kafka Configuration (OPTIONAL)
KAFKA_ENABLED="${KAFKA_ENABLED:-true}"
KAFKA_BOOTSTRAP_SERVERS="${KAFKA_BOOTSTRAP_SERVERS:-}"
KAFKA_API_KEY="${KAFKA_API_KEY:-}"
KAFKA_API_SECRET="${KAFKA_API_SECRET:-}"

# Deployment Configuration
LOG_LEVEL="${LOG_LEVEL:-info}"
STORAGE_PROVIDER="gcs"
DEPLOYMENT_MODE="microservices"

# =======================================================================
# Helper Functions
# =======================================================================
print_header() {
    echo ""
    echo -e "${BLUE}=========================================${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}=========================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "$1 is not installed"
        echo "   Install from: $2"
        exit 1
    fi
}

# =======================================================================
# Prerequisites Check
# =======================================================================
print_header "Checking Prerequisites"

# Check required commands
check_command "gcloud" "https://cloud.google.com/sdk/docs/install"
check_command "kubectl" "https://kubernetes.io/docs/tasks/tools/"
check_command "docker" "https://docs.docker.com/get-docker/"
check_command "git" "https://git-scm.com/downloads"

# Check for GKE auth plugin
if ! command -v gke-gcloud-auth-plugin &> /dev/null; then
    print_error "gke-gcloud-auth-plugin not installed"
    echo ""
    echo "   This plugin is REQUIRED for kubectl to authenticate with GKE."
    echo ""
    echo "   Install it now:"
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "   sudo apt-get install -y google-cloud-sdk-gke-gcloud-auth-plugin"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "   gcloud components install gke-gcloud-auth-plugin"
    else
        echo "   gcloud components install gke-gcloud-auth-plugin"
    fi
    echo ""
    exit 1
fi

print_success "All required commands are installed"

# Check configuration variables
if [ "$PROJECT_ID" = "YOUR_PROJECT_ID" ] || [ -z "$PROJECT_ID" ]; then
    print_error "GCP_PROJECT_ID is not set"
    echo "   Set it with: export GCP_PROJECT_ID=your-project-id"
    exit 1
fi

if [ -z "$MONGODB_URI" ]; then
    print_error "MONGODB_URI is required for Kubernetes deployment"
    echo ""
    echo "   Kubernetes requires external MongoDB because:"
    echo "   • Pods scale horizontally (2-10+ replicas)"
    echo "   • Embedded MongoDB would create isolated databases per pod"
    echo "   • Shared state requires external database"
    echo ""
    echo "   Setup MongoDB Atlas:"
    echo "   1. Visit: https://www.mongodb.com/cloud/atlas/register"
    echo "   2. Create M10+ cluster (\$57/month recommended)"
    echo "   3. Get connection string: mongodb+srv://..."
    echo "   4. Export: export MONGODB_URI='mongodb+srv://...'"
    echo ""
    exit 1
fi

if [ -z "$JWT_SECRET" ]; then
    print_warning "JWT_SECRET not set, generating random secret..."
    JWT_SECRET=$(openssl rand -base64 32)
    print_info "Generated JWT_SECRET: $JWT_SECRET"
    echo "   Save this secret for future deployments"
fi

if [ "$KAFKA_ENABLED" = "true" ]; then
    if [ -z "$KAFKA_BOOTSTRAP_SERVERS" ] || [ -z "$KAFKA_API_KEY" ] || [ -z "$KAFKA_API_SECRET" ]; then
        print_warning "Kafka is enabled but credentials are missing"
        echo "   Disabling Kafka logging. To enable:"
        echo "   1. Create Confluent Cloud account"
        echo "   2. Create topics: opendrive-logs-critical, opendrive-logs-info, opendrive-logs-debug"
        echo "   3. Export Kafka credentials"
        KAFKA_ENABLED="false"
    fi
fi

print_success "Configuration validated"

# =======================================================================
# GCP Authentication and Project Setup
# =======================================================================
print_header "Configuring GCP Project"

gcloud config set project $PROJECT_ID
gcloud auth configure-docker gcr.io

# Enable required APIs
print_info "Enabling required GCP APIs..."
gcloud services enable container.googleapis.com \
    containerregistry.googleapis.com \
    storage-api.googleapis.com \
    --project=$PROJECT_ID

print_success "GCP project configured"

# =======================================================================
# GCS Bucket Setup
# =======================================================================
print_header "Setting up Google Cloud Storage"

if gsutil ls -b gs://$GCS_BUCKET &>/dev/null; then
    print_info "Bucket gs://$GCS_BUCKET already exists"
else
    print_info "Creating GCS bucket: $GCS_BUCKET"
    gcloud storage buckets create gs://$GCS_BUCKET \
        --project=$PROJECT_ID \
        --location=$REGION \
        --uniform-bucket-level-access
    print_success "GCS bucket created"
fi

# Create service account for GCS access
SERVICE_ACCOUNT="opendrive-storage@$PROJECT_ID.iam.gserviceaccount.com"
if gcloud iam service-accounts describe $SERVICE_ACCOUNT &>/dev/null; then
    print_info "Service account already exists"
else
    print_info "Creating service account..."
    gcloud iam service-accounts create opendrive-storage \
        --display-name="OpenDrive Storage Service Account" \
        --project=$PROJECT_ID
    print_success "Service account created"
fi

# Grant permissions
print_info "Granting GCS bucket permissions..."
gcloud storage buckets add-iam-policy-binding gs://$GCS_BUCKET \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/storage.objectAdmin" \
    --quiet

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/storage.objectViewer" \
    --condition=None --quiet 2>/dev/null || true

print_success "GCS setup complete"

# =======================================================================
# Create GKE Cluster
# =======================================================================
print_header "Creating GKE Cluster"

if gcloud container clusters describe $CLUSTER_NAME --zone=${REGION}-a &>/dev/null; then
    print_info "Cluster $CLUSTER_NAME already exists"
else
    print_info "Creating GKE cluster (this takes ~5-7 minutes)..."
    gcloud container clusters create $CLUSTER_NAME \
        --zone=${REGION}-a \
        --machine-type=e2-standard-4 \
        --num-nodes=2 \
        --enable-autoscaling \
        --min-nodes=2 \
        --max-nodes=10 \
        --enable-autorepair \
        --enable-autoupgrade \
        --disk-size=50 \
        --disk-type=pd-standard \
        --enable-ip-alias \
        --enable-stackdriver-kubernetes \
        --addons=HorizontalPodAutoscaling,HttpLoadBalancing \
        --service-account=$SERVICE_ACCOUNT \
        --scopes="https://www.googleapis.com/auth/cloud-platform"

    print_success "Cluster created successfully"
fi

# Get cluster credentials
print_info "Configuring kubectl credentials..."
gcloud container clusters get-credentials $CLUSTER_NAME --zone=${REGION}-a
print_success "kubectl configured"

# =======================================================================
# Clone Repository and Build Images
# =======================================================================
print_header "Building Docker Images"

# Clean up old build directory
if [ -d "temp-build" ]; then
    print_info "Removing old build directory..."
    rm -rf temp-build
fi

# Clone repository
print_info "Cloning repository..."
if ! git clone https://github.com/$GITHUB_USERNAME/storage-system.git temp-build; then
    print_error "Failed to clone repository"
    echo "   Verify: https://github.com/$GITHUB_USERNAME/storage-system"
    exit 1
fi
cd temp-build
print_success "Repository cloned"

# Fix backend dependencies
print_info "Installing backend dependencies..."
cd backend
npm install
cd ..

# Build backend image
print_info "Building backend image (API + Workers)..."
docker build -t gcr.io/$PROJECT_ID/opendrive-backend:latest ./backend
print_success "Backend image built"

# Build frontend image
print_info "Building frontend image..."
docker build -t gcr.io/$PROJECT_ID/opendrive-frontend:latest ./frontend
print_success "Frontend image built"

# Push images to GCR
print_info "Pushing images to Google Container Registry..."
docker push gcr.io/$PROJECT_ID/opendrive-backend:latest
docker push gcr.io/$PROJECT_ID/opendrive-frontend:latest
print_success "Images pushed to GCR"

# Verify images
print_info "Verifying images in GCR..."
gcloud container images list --repository=gcr.io/$PROJECT_ID
print_success "All images verified"

cd ..

# =======================================================================
# Deploy to Kubernetes
# =======================================================================
print_header "Deploying to Kubernetes"

# Create namespace
print_info "Creating namespace..."
kubectl apply -f storage-system/k8s/00-namespace.yaml

# Update manifests with PROJECT_ID
print_info "Updating manifests with project ID..."
for file in storage-system/k8s/*.yaml; do
    sed -i.bak "s/PROJECT_ID/$PROJECT_ID/g" "$file"
done

# Create secrets
print_info "Creating Kubernetes secrets..."
kubectl create secret generic opendrive-secrets \
    --from-literal=mongodb-uri="$MONGODB_URI" \
    --from-literal=jwt-secret="$JWT_SECRET" \
    --from-literal=gcs-project-id="$GCS_PROJECT_ID" \
    --from-literal=gcs-bucket="$GCS_BUCKET" \
    --from-literal=kafka-bootstrap-servers="${KAFKA_BOOTSTRAP_SERVERS:-}" \
    --from-literal=kafka-api-key="${KAFKA_API_KEY:-}" \
    --from-literal=kafka-api-secret="${KAFKA_API_SECRET:-}" \
    --namespace=opendrive \
    --dry-run=client -o yaml | kubectl apply -f -

print_success "Secrets created"

# Apply ConfigMap
print_info "Applying ConfigMap..."
kubectl apply -f storage-system/k8s/02-configmap.yaml

# Deploy API
print_info "Deploying API service (with HPA)..."
kubectl apply -f storage-system/k8s/03-api-deployment.yaml

# Deploy Thumbnail Worker
print_info "Deploying Thumbnail Worker (with HPA)..."
kubectl apply -f storage-system/k8s/04-thumbnail-worker-deployment.yaml

# Deploy Search Worker
print_info "Deploying Search Worker (with HPA)..."
kubectl apply -f storage-system/k8s/05-search-worker-deployment.yaml

# Deploy Frontend
print_info "Deploying Frontend service..."
kubectl apply -f storage-system/k8s/06-frontend-deployment.yaml

# Deploy Ingress
print_info "Deploying Ingress..."
kubectl apply -f storage-system/k8s/07-ingress.yaml

print_success "All resources deployed"

# =======================================================================
# Wait for Deployments
# =======================================================================
print_header "Waiting for Deployments to be Ready"

print_info "Waiting for API pods..."
kubectl wait --for=condition=ready pod -l app=opendrive-api -n opendrive --timeout=300s || true

print_info "Waiting for worker pods..."
kubectl wait --for=condition=ready pod -l tier=worker -n opendrive --timeout=300s || true

print_info "Waiting for frontend pods..."
kubectl wait --for=condition=ready pod -l app=opendrive-frontend -n opendrive --timeout=300s || true

print_success "All pods are ready"

# =======================================================================
# Get Service URLs
# =======================================================================
print_header "Retrieving Service URLs"

print_info "Waiting for LoadBalancer IP (this may take 2-3 minutes)..."
EXTERNAL_IP=""
for i in {1..60}; do
    EXTERNAL_IP=$(kubectl get svc opendrive-frontend-service -n opendrive -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null)
    if [ ! -z "$EXTERNAL_IP" ]; then
        break
    fi
    echo -n "."
    sleep 5
done
echo ""

# =======================================================================
# Deployment Summary
# =======================================================================
print_header "Deployment Complete!"

if [ ! -z "$EXTERNAL_IP" ]; then
    echo -e "${GREEN}Frontend URL:${NC} http://$EXTERNAL_IP"
    echo -e "${GREEN}Backend API:${NC}  http://$EXTERNAL_IP/api"
else
    print_warning "LoadBalancer IP not yet assigned"
    echo "   Run this command to get the IP when ready:"
    echo "   kubectl get svc opendrive-frontend-service -n opendrive"
fi

echo ""
echo "Deployment Architecture:"
echo "  • API Gateway:        2-10 pods (HPA enabled)"
echo "  • Thumbnail Worker:   1-5 pods (HPA enabled)"
echo "  • Search Worker:      1-3 pods (HPA enabled)"
echo "  • Frontend:           2 pods"
echo "  • MongoDB Atlas:      External (managed)"
echo "  • Kafka:              ${KAFKA_ENABLED}"
echo "  • Storage:            GCS (gs://$GCS_BUCKET)"
echo ""
echo "Useful Commands:"
echo "  • Check all pods:        kubectl get pods -n opendrive"
echo "  • Check services:        kubectl get svc -n opendrive"
echo "  • Check HPA status:      kubectl get hpa -n opendrive"
echo "  • View API logs:         kubectl logs -l app=opendrive-api -n opendrive"
echo "  • View worker logs:      kubectl logs -l tier=worker -n opendrive"
echo "  • Scale API manually:    kubectl scale deployment opendrive-api --replicas=5 -n opendrive"
echo "  • Get ingress info:      kubectl get ingress -n opendrive"
echo ""
echo "Estimated Monthly Cost:"
echo "  • GKE Cluster:       \$150-300 (2-10 nodes)"
echo "  • MongoDB Atlas M10: \$57"
echo "  • Load Balancer:     \$20"
echo "  • GCS Storage:       ~\$0.02/GB"
echo "  • Kafka (optional):  \$10-50"
echo "  • Total:             ~\$237-430/month"
echo ""

print_success "Deployment script completed successfully!"
