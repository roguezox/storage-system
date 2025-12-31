#!/bin/bash

# OpenDrive - One-Click Deployment Script
# Usage: sudo ./deploy.sh [domain_name]

set -e

echo "🚀 Starting OpenDrive Deployment..."

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
