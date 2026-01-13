# OpenDrive - Self-Hosted Cloud Storage

<div align="center">

![OpenDrive Logo](https://img.shields.io/badge/OpenDrive-Storage-5E6AD2?style=for-the-badge)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue?style=for-the-badge)](LICENSE)
[![Docker](https://img.shields.io/badge/docker-ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)

**Your files. Your server. No compromises.**

A beautiful, developer-first cloud storage platform that you can self-host on your own infrastructure.

Zero telemetry, full ownership, and designed with Linear's aesthetic in mind.

[Features](#-features) • [Quick Start](#-quick-start) • [Documentation](#-documentation) • [Deployment](#-deployment)

</div>

---

## 📋 Table of Contents

- [Features](#-features)
- [Quick Start](#-quick-start)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
  - [Docker Compose](#docker-compose-recommended)
  - [Manual Setup](#manual-installation)
- [Configuration](#-configuration)
- [Storage Backends](#-storage-backends)
- [Cloud Deployment](#-cloud-deployment)
- [Development](#-development)
- [API Documentation](#-api-documentation)
- [Troubleshooting](#-troubleshooting)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

### Core Functionality
- 📁 **Folder Management** - Create nested folder hierarchies to organize your files
- 📄 **File Upload/Download** - Support for multiple file types with drag-and-drop
- 🔗 **Public Sharing** - Generate shareable links with optional expiration dates
- 🔐 **Authentication** - JWT-based secure authentication system
- 👤 **Multi-User Support** - Isolated storage for each user account
- 🔍 **File Preview** - View images and documents inline

### Technical Features
- 🐳 **Docker Native** - Single-command deployment with Docker Compose
- 💾 **Flexible Storage** - Local disk or S3-compatible object storage
- 🚀 **Modern Stack** - Next.js 16, TypeScript, MongoDB, Express
- 🎨 **Beautiful UI** - Linear-inspired design language
- 📱 **Responsive** - Works seamlessly on desktop and mobile
- 🔒 **Private by Design** - No analytics, no tracking, no telemetry
- 🌐 **API First** - RESTful API for integrations

### Why OpenDrive?
- **100% Data Sovereignty**: Your files stay on your infrastructure
- **No Limits**: Only constrained by your own storage capacity
- **Open Source**: AGPL-3.0 licensed, fully transparent
- **Self-Hosted**: No dependency on third-party services
- **Developer-Friendly**: Clean API, comprehensive documentation

## 🚧 Upcoming Features (Roadmap)

*   **🔍 File Search**: Instant search across all your files and folders.
*   **🗑️ Trash / Recycle Bin**: Restore deleted files instead of permanent loss.
*   **🚀 Scalable Uploads**: Streaming support for massive file uploads (>1GB).
*   **➡️ Move & Copy**: Organizing files made easy with drag-and-drop.
*   **👁️ File Previews**: Thumbnail generation for images and PDF previews.
*   **🖱️ Multi-select**: Batch operations for moving or deleting multiple items.

---

## 🏗️ Deployment Options

OpenDrive offers multiple deployment architectures to match your needs:

### Monolith (Simple)
**Best for:** Personal use, small teams (<100 users)
- Single container deployment
- 5-minute setup
- Minimal resources (2GB RAM)
- See: [Quick Start](#-quick-start)

### Hybrid (Recommended)
**Best for:** Production deployments (5K-10K users)
- Load-balanced API servers
- Dedicated workers for thumbnails and search
- Confluent Cloud Kafka (free tier)
- Centralized logging with Grafana
- Easy self-hosting with one-command setup
- See: [QUICKSTART-HYBRID.md](QUICKSTART-HYBRID.md) and [HYBRID-DEPLOYMENT.md](HYBRID-DEPLOYMENT.md)

### Full Microservices (Enterprise)
**Best for:** Large-scale deployments (>10K users)
- Kubernetes orchestration
- Auto-scaling
- High availability
- Coming soon!

---

## 🚀 Quick Start

Get OpenDrive running in under 5 minutes:

```bash
# 1. Clone the repository
git clone https://github.com/roguezox/storage-system.git
cd storage-system

# 2. Create environment file
cp .env.example .env

# 3. Generate JWT secret and edit configuration
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
nano .env  # Add MongoDB password and other settings

# 4. Start with Docker Compose
docker-compose up -d

# 5. View logs
docker-compose logs -f
```

**Access:** http://localhost:3000

**First Time Setup:** Create your account on the registration page

---

## 📦 Prerequisites

### Required
- **Docker** 20.10+ and **Docker Compose** 2.0+
- **MongoDB** 5.0+ (included in Docker setup)
- **Node.js** 18+ (for local development only)
- **2 GB RAM minimum** (4 GB recommended)
- **10 GB disk space minimum** (for application + data)

### Optional
- **S3-Compatible Storage** - AWS S3, MinIO, DigitalOcean Spaces
- **SSL Certificate** - Let's Encrypt or managed certificate
- **Reverse Proxy** - Nginx or Caddy for production deployments
- **Domain Name** - For public access and SSL

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 1 core | 2+ cores |
| RAM | 2 GB | 4+ GB |
| Disk | 10 GB | 50+ GB |
| Bandwidth | 10 Mbps | 100+ Mbps |

---

## 🛠 Installation

### Docker Compose (Recommended)

**Best for:** Local development, home servers, single-server deployments

#### Step 1: Clone Repository

```bash
git clone https://github.com/roguezox/storage-system.git
cd storage-system
```

#### Step 2: Configure Environment

```bash
# Create .env file
cp .env.example .env

# Generate secure JWT secret
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env

# Edit configuration
nano .env
```

**Required variables in `.env`:**

```env
# JWT Secret (REQUIRED)
JWT_SECRET=your_generated_jwt_secret_here

# MongoDB Configuration
MONGODB_URI=mongodb://mongodb:27017/opendrive
MONGO_INITDB_ROOT_PASSWORD=your_secure_mongodb_password

# Storage Configuration
STORAGE_PROVIDER=local  # or 's3'
STORAGE_PATH=./uploads

# Application Settings
PORT=5000
NODE_ENV=production
MAX_FILE_SIZE=104857600  # 100MB

# Frontend URL
NEXT_PUBLIC_API_URL=http://localhost:5000
```

#### Step 3: Start Services

```bash
# Start all services in background
docker-compose up -d

# View logs in real-time
docker-compose logs -f

# Check service status
docker-compose ps
```

#### Step 4: Verify Installation

```bash
# Check backend health
curl http://localhost:5000/api/health

# Expected response: {"status":"ok"}
```

Access the application at **http://localhost:3000**

#### Step 5: Create First User

1. Navigate to http://localhost:3000
2. Click "Register" or "Sign Up"
3. Enter email and password
4. Start uploading files!

### Manual Installation

**For advanced users or custom setups**

#### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
nano .env

# Build TypeScript
npm run build

# Start production server
npm run start
```

#### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local
nano .env.local

# Build for production
npm run build

# Start production server
npm run start
```

#### MongoDB Setup

```bash
# Install MongoDB (Ubuntu/Debian)
sudo apt-get install mongodb-org

# Start MongoDB
sudo systemctl start mongod

# Enable on boot
sudo systemctl enable mongod
```

---

## ⚙️ Configuration

### Environment Variables Reference

#### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | Secret key for JWT tokens (min 32 chars) | Generate with: `openssl rand -hex 32` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/opendrive` |

#### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Backend server port |
| `NODE_ENV` | `development` | Environment mode (`development`, `production`) |
| `MAX_FILE_SIZE` | `104857600` | Max upload size in bytes (100MB) |
| `STORAGE_PROVIDER` | `local` | Storage backend (`local` or `s3`) |
| `STORAGE_PATH` | `./uploads` | Local storage directory path |
| `CORS_ORIGIN` | `*` | CORS allowed origins |
| `JWT_EXPIRES_IN` | `7d` | JWT token expiration time |
| `BCRYPT_ROUNDS` | `10` | Password hashing rounds |

#### S3 Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `S3_BUCKET` | S3 bucket name | `my-opendrive-bucket` |
| `S3_REGION` | AWS region | `us-east-1` |
| `S3_ACCESS_KEY_ID` | AWS access key | `AKIAIOSFODNN7EXAMPLE` |
| `S3_SECRET_ACCESS_KEY` | AWS secret key | Your secret key |
| `S3_ENDPOINT` | Custom endpoint (MinIO, etc.) | `https://minio.example.com` |

### Application Configuration

Create `config.json` for advanced settings:

```json
{
  "app": {
    "name": "OpenDrive",
    "version": "1.0.0",
    "maintenance": false
  },
  "upload": {
    "maxFileSize": 104857600,
    "allowedExtensions": [".jpg", ".png", ".pdf", ".docx", ".txt"],
    "maxFilesPerUpload": 10
  },
  "security": {
    "jwtExpiration": "7d",
    "sessionTimeout": 3600,
    "passwordMinLength": 8,
    "requireEmailVerification": false
  },
  "storage": {
    "provider": "local",
    "retentionDays": 30,
    "enableCompression": false
  }
}
```

---

## ☁️ Cloud Deployment (GCP, AWS, DigitalOcean)

> ⚠️ **IMPORTANT: Frontend Rebuild Required**
> 
> The pre-built Docker Hub frontend image (`opendrive-frontend:latest`) has `http://localhost:5000` as the API URL baked in at build time.
> 
> **For cloud deployments, you MUST rebuild the frontend** with your backend's public URL, or share links and API calls will fail!

### Cloud Deployment Steps

1. **Deploy backend first** → Note the public URL (e.g., `https://backend.run.app`)
2. **Rebuild frontend** with the backend URL:
   ```bash
   git clone https://github.com/roguezox/storage-system.git
   cd storage-system/frontend
   docker build --build-arg NEXT_PUBLIC_API_URL=https://YOUR-BACKEND-URL -t your-registry/opendrive-frontend .
   docker push your-registry/opendrive-frontend
   ```
3. **Deploy frontend** using the rebuilt image

### Platform-Specific Guides
- [Google Cloud Run](/install/gcp)
- [AWS App Runner](/install/aws)
- [DigitalOcean App Platform](/install/digitalocean)

### Use the Setup Wizard
The easiest way is to use our [Setup Wizard](/setup) which generates deployment scripts with the correct configuration.

## 💾 Storage Backends

OpenDrive supports multiple storage backends for maximum flexibility.

### Local Filesystem (Default)

**Pros:**
- ✅ Simple setup, no external dependencies
- ✅ Fast local access
- ✅ No additional costs
- ✅ Works offline

**Cons:**
- ⚠️ Limited scalability
- ⚠️ Single point of failure
- ⚠️ Manual backup management

**Configuration:**

```env
STORAGE_PROVIDER=local
STORAGE_PATH=./uploads
```

**Docker Volume:**

```yaml
volumes:
  - ./uploads:/app/uploads  # Local directory
  # OR
  - opendrive_data:/app/uploads  # Named volume
```

---

### AWS S3

**Pros:**
- ✅ Unlimited scalability
- ✅ 99.999999999% durability
- ✅ Automatic backups
- ✅ CDN integration

**Cons:**
- ⚠️ Additional costs
- ⚠️ Network latency
- ⚠️ Requires AWS account

**Configuration:**

```env
STORAGE_PROVIDER=s3
S3_BUCKET=my-opendrive-bucket
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
S3_SECRET_ACCESS_KEY=your_secret_key
```

**Cost Estimate:** ~$0.023/GB/month + $0.005/1,000 requests

---

### MinIO (Self-Hosted S3)

**Pros:**
- ✅ S3-compatible API
- ✅ Self-hosted, no external costs
- ✅ High performance
- ✅ Open source

**Cons:**
- ⚠️ Requires additional infrastructure
- ⚠️ Manual maintenance

**Docker Compose Example:**

```yaml
services:
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - minio_data:/data
```

**Configuration:**

```env
STORAGE_PROVIDER=s3
S3_ENDPOINT=http://minio:9000
S3_BUCKET=opendrive
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
```

---

### DigitalOcean Spaces

**Pros:**
- ✅ Simple $5/month pricing
- ✅ S3-compatible
- ✅ Built-in CDN
- ✅ 250 GB storage + 1 TB transfer included

**Configuration:**

```env
STORAGE_PROVIDER=s3
S3_BUCKET=my-space
S3_REGION=nyc3
S3_ACCESS_KEY_ID=your_spaces_key
S3_SECRET_ACCESS_KEY=your_spaces_secret
S3_ENDPOINT=https://nyc3.digitaloceanspaces.com
```

---

## 💻 Tech Stack

*   **Frontend**: Next.js 14, React, TailwindCSS, Zustand
*   **Backend**: Node.js, Express, Mongoose
*   **Database**: MongoDB
*   **Storage**: Abstracted provider system (LocalFS / S3)

---

## 🛠 Development

### Local Development Setup

```bash
# 1. Clone repository
git clone https://github.com/roguezox/storage-system.git
cd storage-system

# 2. Start MongoDB
docker run -d -p 27017:27017 --name mongodb mongo:7

# 3. Backend setup
cd backend
npm install
cp .env.example .env
# Edit .env with your configuration
npm run dev  # Runs on http://localhost:5000

# 4. Frontend setup (in new terminal)
cd frontend
npm install
cp .env.local.example .env.local
npm run dev  # Runs on http://localhost:3000
```

### Project Structure

```
storage-system/
├── backend/
│   ├── src/
│   │   ├── config/         # Configuration files
│   │   ├── controllers/    # Route controllers
│   │   ├── middleware/     # Express middleware
│   │   ├── models/         # Mongoose models
│   │   ├── routes/         # API routes
│   │   └── server.ts       # Entry point
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── app/            # Next.js app directory
│   │   ├── components/     # React components
│   │   ├── lib/            # Utilities
│   │   └── stores/         # State management
│   └── package.json
│
├── docker-compose.yml
└── README.md
```

---

## 🐛 Troubleshooting

### Common Issues

#### MongoDB Connection Failed

**Symptoms:**
```
MongooseServerSelectionError: connect ECONNREFUSED
```

**Solutions:**
- Verify MongoDB is running: `docker ps | grep mongodb`
- Check `MONGODB_URI` in `.env`
- For Docker: use `mongodb://mongodb:27017` not `localhost`
- View MongoDB logs: `docker logs mongodb`

---

#### JWT Authentication Errors

**Symptoms:**
```
401 Unauthorized: JWT must be provided
```

**Solutions:**
- Verify `JWT_SECRET` is set in `.env` (min 32 characters)
- Check Authorization header format: `Bearer <token>`
- Clear browser cookies and re-login
- Token may be expired (default: 7 days)

---

#### File Upload Fails

**Symptoms:**
```
413 Payload Too Large
```

**Solutions:**
- Increase `MAX_FILE_SIZE` in `.env`
- Check available disk space: `df -h`
- Verify upload directory permissions: `chmod 755 uploads`
- For Nginx proxy, add: `client_max_body_size 100M;`

---

#### Frontend Can't Connect to Backend

**Symptoms:**
- CORS errors in browser console
- API requests fail

**Solutions:**
- Verify `NEXT_PUBLIC_API_URL` in frontend `.env.local`
- Check backend is running: `curl http://localhost:5000/api/health`
- For Docker: use service names, not `localhost`
- Check backend CORS configuration

---

### Debug Mode

Enable detailed logging:

```env
# .env
NODE_ENV=development
LOG_LEVEL=debug
```

View logs:
```bash
# Docker Compose
docker-compose logs -f backend
docker-compose logs -f frontend

# Direct
npm run dev  # Shows logs in terminal
```

---

## 📡 API Documentation

### Authentication

#### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}

Response:
{
  "token": "jwt_token",
  "user": { "id": "...", "email": "..." }
}
```

### Folders

#### Create Folder
```http
POST /api/folders
Authorization: Bearer <token>

{
  "name": "My Folder",
  "parentId": null
}
```

#### Get All Folders
```http
GET /api/folders
Authorization: Bearer <token>
```

### Files

#### Upload File
```http
POST /api/files
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <binary>
folderId: <folder_id>
```

#### Download File
```http
GET /api/files/:id/download
Authorization: Bearer <token>
```

For complete API documentation, see our [Postman Collection](Storage%20Platform%20API.postman_collection.json).

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

We welcome contributions! Here's how you can help:

### Reporting Bugs
1. Check existing issues first
2. Create new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Docker version, etc.)

### Feature Requests
1. Check roadmap and existing issues
2. Open new issue with:
   - Use case description
   - Proposed solution
   - Alternative approaches considered

### Pull Requests
1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Make changes with tests
4. Commit: `git commit -m 'Add amazing feature'`
5. Push: `git push origin feature/amazing-feature`
6. Open Pull Request with clear description

### Development Guidelines
- Follow existing code style
- Add tests for new features
- Update documentation
- Keep commits atomic and descriptive
- Run linter before committing

---

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Inspired by [Linear's](https://linear.app/) beautiful design
- Icons from [React Icons](https://react-icons.github.io/react-icons/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)

---

## 📬 Contact

**Author:** Aditya Kumar
**Email:** adityak03@outlook.com
**LinkedIn:** [aditya-kumar03](https://www.linkedin.com/in/aditya-kumar03)
**GitHub:** [@roguezox](https://github.com/roguezox)

---

<div align="center">

**[⬆ back to top](#opendrive---self-hosted-cloud-storage)**

Made with ❤️ for developers who value ownership

</div>
