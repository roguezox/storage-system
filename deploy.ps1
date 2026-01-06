# OpenDrive - Deployment Script (PowerShell)
# Usage: .\deploy.ps1 [docker|cloudrun] [options]
# Examples:
#   .\deploy.ps1 docker              # Deploy using Docker Compose (default)
#   .\deploy.ps1 cloudrun PROJECT_ID REGION  # Deploy backend to Cloud Run

param(
    [string]$DeploymentType = "docker",
    [string]$ProjectId = "your-gcp-project-id",
    [string]$Region = "us-central1"
)

$ErrorActionPreference = "Stop"

if ($DeploymentType -eq "cloudrun") {
    # Cloud Run Deployment for Backend
    $ServiceName = "opendrive-backend"
    $ImageName = "gcr.io/$ProjectId/$ServiceName"

    Write-Host "🚀 Deploying OpenDrive Backend to Cloud Run..." -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    Write-Host "Project ID: $ProjectId"
    Write-Host "Region: $Region"
    Write-Host "Service: $ServiceName"
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Build and push Docker image to Google Container Registry
    Write-Host "📦 Building Docker image..." -ForegroundColor Yellow
    Push-Location backend
    gcloud builds submit --tag $ImageName --project=$ProjectId .
    Pop-Location

    # Deploy to Cloud Run with minimum 1 instance
    Write-Host "🌐 Deploying to Cloud Run with min 1 instance..." -ForegroundColor Yellow
    gcloud run deploy $ServiceName `
        --image=$ImageName `
        --platform=managed `
        --region=$Region `
        --project=$ProjectId `
        --port=5000 `
        --min-instances=1 `
        --max-instances=10 `
        --memory=512Mi `
        --cpu=1 `
        --timeout=300 `
        --allow-unauthenticated `
        --set-env-vars="NODE_ENV=production"

    # Get the service URL
    $ServiceUrl = gcloud run services describe $ServiceName `
        --platform=managed `
        --region=$Region `
        --project=$ProjectId `
        --format='value(status.url)'

    Write-Host ""
    Write-Host "✅ Cloud Run Deployment Complete!" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    Write-Host "🌐 Backend URL: $ServiceUrl" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    Write-Host ""
    Write-Host "⚠️  Note: Set environment variables using:" -ForegroundColor Yellow
    Write-Host "gcloud run services update $ServiceName --region=$Region ``"
    Write-Host "  --update-env-vars JWT_SECRET=your_secret,MONGODB_URI=your_mongodb_uri"

} else {
    # Docker Compose Deployment (Default)
    Write-Host "🚀 Starting OpenDrive Docker Deployment..." -ForegroundColor Cyan

    # 1. Check Docker Installation
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Host "❌ Docker is not installed. Please install Docker Desktop:" -ForegroundColor Red
        Write-Host "   https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
        exit 1
    } else {
        Write-Host "✅ Docker is installed." -ForegroundColor Green
    }

    # 2. Repository handling
    $RepoUrl = "https://github.com/yourusername/opendrive.git"
    $AppDir = "C:\opendrive"

    if (-not (Test-Path $AppDir)) {
        Write-Host "📂 Cloning repository to $AppDir..." -ForegroundColor Yellow
        git clone $RepoUrl $AppDir
    } else {
        Write-Host "📂 Repository already exists at $AppDir. Pulling latest..." -ForegroundColor Yellow
        Push-Location $AppDir
        git pull
        Pop-Location
    }

    Push-Location $AppDir

    # 3. Configure Environment
    if (-not (Test-Path .env)) {
        Write-Host "⚙️ Configuring environment..." -ForegroundColor Yellow
        Copy-Item .env.example .env

        # Generate random JWT secret
        $JwtSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
        (Get-Content .env) -replace 'JWT_SECRET=.*', "JWT_SECRET=$JwtSecret" | Set-Content .env

        Write-Host "✅ .env file created with secure JWT secret." -ForegroundColor Green
    } else {
        Write-Host "✅ .env file already exists." -ForegroundColor Green
    }

    # 4. Start Services
    Write-Host "🚀 Starting services..." -ForegroundColor Yellow
    docker compose up -d --build

    # Get public IP (Windows alternative)
    try {
        $PublicIp = (Invoke-WebRequest -Uri "https://api.ipify.org" -UseBasicParsing).Content
    } catch {
        $PublicIp = "localhost"
    }

    Write-Host ""
    Write-Host "🎉 Deployment Complete!" -ForegroundColor Green
    Write-Host "------------------------------------------------"
    Write-Host "🌐 Access your drive at: http://${PublicIp}:3000" -ForegroundColor Cyan
    Write-Host "------------------------------------------------"

    Pop-Location
}
