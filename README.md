# OpenDrive - Self-Hosted Cloud Storage

[![Build and Push Docker Images](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/docker-publish.yml)
[![Docker Hub](https://img.shields.io/docker/pulls/YOUR_DOCKERHUB_USERNAME/opendrive-frontend)](https://hub.docker.com/r/YOUR_DOCKERHUB_USERNAME/opendrive-frontend)

## 🚀 Quick Start with Docker Hub

```bash
# 1. Create environment file
curl -o .env https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/.env.example

# 2. Edit .env with your settings
# Required: DOCKERHUB_USERNAME, JWT_SECRET, MONGO_PASSWORD

# 3. Download and run
curl -o docker-compose.hub.yml https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/docker-compose.hub.yml
docker-compose -f docker-compose.hub.yml up -d
```

---

A modern, self-hosted cloud storage platform that gives you complete control over your data. "Bring Your Own Storage" design lets you store files on local disk, S3, MinIO, or any compatible provider.

![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)
![Docker](https://img.shields.io/badge/docker-ready-green.svg)

## 🚀 Key Features

*   **100% Data Sovereignty**: Files exist on your server, not in a black box.
*   **Pluggable Storage**: Use local disk, AWS S3, MinIO, DigitalOcean Spaces, etc.
*   **Zero Limits**: No artificial storage caps or file size limits.
*   **Modern UI**: Built with Next.js 14 and TailwindCSS for a premium experience.
*   **Secure Sharing**: Generate public links with optional expiration (Pro).

---

## 🛠 Deployment

The easiest way to run OpenDrive is with Docker Compose.

### Quick Start (Production)

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/opendrive.git
    cd opendrive
    ```

2.  **Configure Environment**
    ```bash
    cp .env.example .env
    # Edit .env with your secrets and settings
    nano .env
    ```

3.  **Start Services**
    ```bash
    docker-compose up -d
    ```

4.  **Access**
    Open [http://localhost:3000](http://localhost:3000) to create your admin account.

### Storage Configuration

OpenDrive supports multiple storage backends. Configure via `.env` file:

**Option 1: Local Disk (Default)**
Simple, fast, and great for single-server setups.
```ini
STORAGE_PROVIDER=local
STORAGE_PATH=./uploads
```

**Option 2: S3 / MinIO**
Scalable object storage. Works with AWS, MinIO, Backblaze B2, Google Cloud Storage, etc.
```ini
STORAGE_PROVIDER=s3
S3_ENDPOINT=http://minio:9000  # Leave empty for AWS S3
S3_BUCKET=my-drive-bucket
S3_REGION=us-east-1
S3_ACCESS_KEY=your_key
S3_SECRET_KEY=your_secret
```

---

## 💻 Tech Stack

*   **Frontend**: Next.js 14, React, TailwindCSS, Zustand
*   **Backend**: Node.js, Express, Mongoose
*   **Database**: MongoDB
*   **Storage**: Abstracted provider system (LocalFS / S3)

---

## 📜 License

### Open Source Edition
OpenDrive is free software licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.
You are free to use, modify, and distribute it, provided you share your improvements with the community.

See [LICENSE](LICENSE) for details.

### Enterprise Edition
Need more? Our Enterprise plan offers:
*   Multi-user management & RBAC
*   SSO / SAML Integration
*   Audit Logs & Compliance Tools
*   Priority Support

See [ENTERPRISE-LICENSE.md](ENTERPRISE-LICENSE.md) for commercial terms.

---

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a pull request.
