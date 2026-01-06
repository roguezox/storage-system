#!/bin/bash

# OpenDrive - Deployment Script
# Usage: ./deploy.sh [docker|cloudrun] [options]
# Examples:
#   ./deploy.sh docker              # Deploy using Docker Compose (default)
#   ./deploy.sh cloudrun PROJECT_ID REGION  # Deploy backend to Cloud Run

set -e

DEPLOYMENT_TYPE="${1:-docker}"

if [ "$DEPLOYMENT_TYPE" == "cloudrun" ]; then
    # Cloud Run Deployment for Backend
    PROJECT_ID="${2:-your-gcp-project-id}"
    REGION="${3:-us-central1}"
    SERVICE_NAME="opendrive-backend"
    IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

    echo "🚀 Deploying OpenDrive Backend to Cloud Run..."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Project ID: ${PROJECT_ID}"
    echo "Region: ${REGION}"
    echo "Service: ${SERVICE_NAME}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Build and push Docker image to Google Container Registry
    echo "📦 Building Docker image..."
    cd backend
    gcloud builds submit --tag "${IMAGE_NAME}" --project="${PROJECT_ID}" .

    # Deploy to Cloud Run with minimum 1 instance
    echo "🌐 Deploying to Cloud Run with min 1 instance..."
    gcloud run deploy "${SERVICE_NAME}" \
      --image="${IMAGE_NAME}" \
      --platform=managed \
      --region="${REGION}" \
      --project="${PROJECT_ID}" \
      --port=5000 \
      --min-instances=1 \
      --max-instances=10 \
      --memory=512Mi \
      --cpu=1 \
      --timeout=300 \
      --allow-unauthenticated \
      --set-env-vars="NODE_ENV=production"

    # Get the service URL
    SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
      --platform=managed \
      --region="${REGION}" \
      --project="${PROJECT_ID}" \
      --format='value(status.url)')

    echo ""
    echo "✅ Cloud Run Deployment Complete!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🌐 Backend URL: ${SERVICE_URL}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "⚠️  Note: Set environment variables using:"
    echo "gcloud run services update ${SERVICE_NAME} --region=${REGION} \\"
    echo "  --update-env-vars JWT_SECRET=your_secret,MONGODB_URI=your_mongodb_uri"

else
    # Docker Compose Deployment (Default)
    echo "🚀 Starting OpenDrive Docker Deployment..."

    # 1. Install Docker & Docker Compose
    if ! command -v docker &> /dev/null; then
        echo "📦 Installing Docker..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh
        rm get-docker.sh
        echo "✅ Docker installed."
    else
        echo "✅ Docker is already installed."
    fi

    # 2. Clone Repository (if not already present)
    # Note: Update this URL to your actual public repository
    REPO_URL="https://github.com/yourusername/opendrive.git"
    APP_DIR="/opt/opendrive"

    if [ ! -d "$APP_DIR" ]; then
        echo "📂 Cloning repository to $APP_DIR..."
        git clone "$REPO_URL" "$APP_DIR"
    else
        echo "📂 Repository already exists at $APP_DIR. Pulling latest..."
        cd "$APP_DIR"
        git pull
    fi

    cd "$APP_DIR"

    # 3. Configure Environment
    if [ ! -f .env ]; then
        echo "⚙️ Configuring environment..."
        cp .env.example .env

        # Generate random JWT secret
        JWT_SECRET=$(openssl rand -hex 32)
        sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env

        echo "✅ .env file created with secure JWT secret."
    else
        echo "✅ .env file already exists."
    fi

    # 4. Start Services
    echo "🚀 Starting services..."
    docker compose up -d --build

    echo ""
    echo "🎉 Deployment Complete!"
    echo "------------------------------------------------"
    echo "🌐 Access your drive at: http://$(curl -s ifconfig.me):3000"
    echo "------------------------------------------------"
fi
