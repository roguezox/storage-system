# OpenDrive Backend

A Node.js/Express REST API for a self-hosted cloud storage platform with user authentication, folder/file management, pluggable storage backends (local disk or S3-compatible), public sharing capabilities, and soft delete with trash/restore functionality.

## 🚀 Live Demo

**API URL:** https://storage-system-uysk.vercel.app/

---

## Tech Stack

| Category | Technology |
|----------|------------|
| **Runtime** | Node.js 20+ |
| **Framework** | Express.js 5 |
| **Database** | MongoDB with Mongoose 9 ODM |
| **Authentication** | JWT (JSON Web Tokens) with bcrypt |
| **File Storage** | Pluggable: Local Disk or S3/MinIO |
| **File Uploads** | Multer (memory storage, up to 100MB) |
| **Security** | Helmet, CORS, Rate Limiting |
| **Deployment** | Vercel Serverless / Docker |

---

## Quick Start

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret

# Start development server
npm run dev
```

The server will start on `http://localhost:5000`.

---

## Environment Variables

Create a `.env` file in the backend directory:

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/drive` or MongoDB Atlas URI |
| `JWT_SECRET` | Secret key for JWT signing (min 32 chars) | `your-super-secret-key-min-32-characters` |
| `PORT` | Server port | `5000` |

### Storage Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `STORAGE_PROVIDER` | Storage backend: `local` or `s3` | `local` |
| `STORAGE_PATH` | Path for local storage | `./uploads` |

### S3/MinIO Settings (when `STORAGE_PROVIDER=s3`)

| Variable | Description |
|----------|-------------|
| `S3_ENDPOINT` | S3 endpoint URL (empty for AWS S3, or http://localhost:9000 for MinIO) |
| `S3_BUCKET` | Bucket name |
| `S3_REGION` | AWS region (e.g., us-east-1) |
| `S3_ACCESS_KEY` | Access key ID |
| `S3_SECRET_KEY` | Secret access key |

### Optional Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `CORS_ORIGIN` | Allowed CORS origin | `*` (all origins) |
| `MAX_FILE_SIZE` | Max file upload size in bytes | `104857600` (100MB) |
| `TRASH_RETENTION_DAYS` | Days to keep files in trash | `30` |

---

## API Endpoints

### Health Check

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | API status and version | No |
| GET | `/api/health` | Health check with database status | No |

### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Register new user (returns JWT) | No |
| POST | `/api/auth/login` | Login and get JWT token | No |
| GET | `/api/auth/me` | Get current authenticated user | Yes |

**Request Body (Register/Login):**
```json
{
  "email": "user@example.com",
  "password": "strongPassword123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "role": "admin"
  }
}
```

### Folders (Protected)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/folders` | Get all root folders for user | Yes |
| GET | `/api/folders/stats/summary` | Get user stats (folder count, file count, storage used) | Yes |
| GET | `/api/folders/:id` | Get folder with subfolders, files & breadcrumb trail | Yes |
| POST | `/api/folders` | Create new folder | Yes |
| PUT | `/api/folders/:id` | Rename folder | Yes |
| DELETE | `/api/folders/:id` | Soft delete folder (moves to trash) | Yes |
| POST | `/api/folders/:id/share` | Generate public share link | Yes |
| DELETE | `/api/folders/:id/share` | Revoke share link | Yes |

**Create Folder Request:**
```json
{
  "name": "My Documents",
  "parentId": "507f1f77bcf86cd799439011"  // Optional, null for root
}
```

**Folder Response:**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "My Documents",
  "parentId": null,
  "ownerId": "507f191e810c19729de860ea",
  "path": "/",
  "isShared": false,
  "shareId": null,
  "deletedAt": null,
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

### Files (Protected)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/files/folder/:folderId` | Get all files in a folder | Yes |
| POST | `/api/files` | Upload file (`multipart/form-data`) | Yes |
| GET | `/api/files/:id/download` | Download/view file with proper MIME type | Yes |
| PUT | `/api/files/:id` | Rename file | Yes |
| DELETE | `/api/files/:id` | Soft delete file (moves to trash) | Yes |
| POST | `/api/files/:id/share` | Generate public share link | Yes |
| DELETE | `/api/files/:id/share` | Revoke share link | Yes |

**Upload File Request (FormData):**
```
POST /api/files
Content-Type: multipart/form-data

file: [binary data]
folderId: "507f1f77bcf86cd799439011"
```

**File Response:**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "1642251000000_document.pdf",
  "originalName": "document.pdf",
  "folderId": "507f191e810c19729de860ea",
  "ownerId": "507f191e810c19729de860eb",
  "storageKey": "uploads/1642251000000_document.pdf",
  "storageProvider": "local",
  "mimeType": "application/pdf",
  "size": 1048576,
  "isShared": false,
  "shareId": null,
  "deletedAt": null,
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

### Trash Management (Protected)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/trash/files` | Get all trashed files | Yes |
| GET | `/api/trash/folders` | Get all trashed folders | Yes |
| POST | `/api/trash/files/:id/restore` | Restore file from trash | Yes |
| POST | `/api/trash/folders/:id/restore` | Restore folder from trash | Yes |
| DELETE | `/api/trash/files/:id/permanent` | Permanently delete file | Yes |
| DELETE | `/api/trash/folders/:id/permanent` | Permanently delete folder | Yes |
| POST | `/api/trash/empty` | Empty entire trash | Yes |

### Search (Protected)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/search?q=query&type=all` | Search files and folders by name | Yes |

**Query Parameters:**
- `q` (required): Search query string
- `type` (optional): `files`, `folders`, or `all` (default: `all`)

**Search Response:**
```json
{
  "files": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "report.pdf",
      "size": 1048576,
      "mimeType": "application/pdf",
      "folder": {
        "name": "Documents",
        "path": "/Documents/"
      }
    }
  ],
  "folders": [
    {
      "_id": "507f191e810c19729de860ea",
      "name": "Reports",
      "path": "/Documents/Reports/",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### Public Access (No Auth Required)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/public/:shareId` | Get shared folder/file info | No |
| GET | `/api/public/:shareId/folder/:folderId` | Navigate into shared subfolder | No |
| GET | `/api/public/:shareId/file/:fileId/download` | Download file from shared folder | No |
| GET | `/api/public/:shareId/download` | Download directly shared file | No |

---

## Database Models

### User Model

```javascript
{
  email: String,        // unique, required, lowercase, validated
  password: String,     // hashed with bcrypt (12 rounds)
  role: String,         // 'admin' | 'user' (default: 'admin')
  createdAt: Date,      // auto-generated
  updatedAt: Date       // auto-updated
}
```

**Indexes:**
- `email` (unique)

**Methods:**
- `comparePassword(password)` - Compares password with hash

### Folder Model

```javascript
{
  name: String,         // required, trimmed, max 255 chars
  parentId: ObjectId,   // ref: Folder (null for root)
  ownerId: ObjectId,    // ref: User, required
  path: String,         // e.g., "/Documents/Projects/", auto-generated
  isShared: Boolean,    // default: false
  shareId: String,      // UUID when shared (indexed, unique)
  deletedAt: Date,      // null for active, date for trashed
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `ownerId + parentId`
- `ownerId + deletedAt` (for trash queries)
- `shareId` (unique, sparse)
- `name` (text index for search)

**Virtuals:**
- `subfolders` - Populate child folders
- `files` - Populate files in folder

### File Model

```javascript
{
  name: String,           // unique generated name (timestamp_originalname)
  originalName: String,   // user's original filename
  folderId: ObjectId,     // ref: Folder, required
  ownerId: ObjectId,      // ref: User, required
  storageKey: String,     // reference to file in storage backend
  storageProvider: String,// 'local' | 's3'
  mimeType: String,       // e.g., 'image/jpeg', 'application/pdf'
  size: Number,           // bytes
  isShared: Boolean,      // default: false
  shareId: String,        // UUID when shared (indexed, unique)
  deletedAt: Date,        // null for active, date for trashed
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `ownerId + folderId`
- `ownerId + deletedAt` (for trash queries)
- `shareId` (unique, sparse)
- `originalName` (text index for search)

---

## Storage Providers

The backend supports pluggable storage backends via the `storage/` module:

### Local Storage (Default)

Files are stored on the local filesystem in the `STORAGE_PATH` directory.

**Configuration:**
```env
STORAGE_PROVIDER=local
STORAGE_PATH=./uploads
```

**Pros:**
- ✅ Simple setup, no external dependencies
- ✅ Fast for small deployments
- ✅ No additional costs

**Cons:**
- ❌ Not suitable for distributed deployments
- ❌ Limited by disk space
- ❌ Manual backup required

**File Structure:**
```
uploads/
├── 1642251000000_document.pdf
├── 1642251100000_image.jpg
└── 1642251200000_video.mp4
```

### S3-Compatible Storage

Works with AWS S3, MinIO, Backblaze B2, DigitalOcean Spaces, Cloudflare R2, and any S3-compatible service.

**Configuration:**
```env
STORAGE_PROVIDER=s3
S3_ENDPOINT=http://localhost:9000  # Empty for AWS S3
S3_BUCKET=drive
S3_REGION=us-east-1
S3_ACCESS_KEY=your_access_key
S3_SECRET_KEY=your_secret_key
```

**Pros:**
- ✅ Scalable to petabytes
- ✅ Works with cloud-native infrastructure
- ✅ Automatic redundancy and backups (with proper S3 config)
- ✅ CDN integration possible

**Cons:**
- ❌ Requires external service
- ❌ Additional costs for storage and bandwidth
- ❌ Network latency for uploads/downloads

**MinIO Setup (Docker):**
```bash
docker run -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=admin \
  -e MINIO_ROOT_PASSWORD=password123 \
  minio/minio server /data --console-address ":9001"
```

---

## Authentication Flow

1. **Registration:**
   - User sends email + password to `/api/auth/register`
   - Password is hashed with bcrypt (12 rounds)
   - User record created in database
   - JWT token generated and returned

2. **Login:**
   - User sends email + password to `/api/auth/login`
   - Password compared with stored hash
   - JWT token generated and returned (valid for 7 days)

3. **Protected Routes:**
   - Client sends token in `Authorization: Bearer <token>` header
   - Auth middleware validates token on protected routes
   - Decoded user ID attached to `req.userId`
   - Invalid/expired tokens return 401 Unauthorized

4. **Token Refresh:**
   - Currently tokens expire after 7 days
   - Client must re-login after expiry

---

## Sharing Mechanism

### Folder Sharing

1. User calls `POST /api/folders/:id/share`
2. System generates unique UUID (`shareId`)
3. Public can access via `/api/public/:shareId`
4. Public users can:
   - View folder contents (subfolders + files)
   - Navigate into subfolders
   - Download any file in the shared folder tree
5. Revoke access via `DELETE /api/folders/:id/share`

### File Sharing

1. User calls `POST /api/files/:id/share`
2. System generates unique UUID (`shareId`)
3. Public can download via `/api/public/:shareId/download`
4. Revoke access via `DELETE /api/files/:id/share`

**Security Notes:**
- Share IDs are UUIDv4 (cryptographically random)
- No authentication required for public endpoints
- Share links don't expire (manual revocation only)
- Deleted items cannot be accessed via share links

---

## Trash/Soft Delete System

### How It Works

1. **Soft Delete:**
   - DELETE endpoints set `deletedAt: new Date()` instead of removing records
   - Folder deletion cascades to all subfolders and files
   - Files remain in storage until permanent deletion

2. **Trash Listing:**
   - GET `/api/trash/files` returns files where `deletedAt != null`
   - GET `/api/trash/folders` returns folders where `deletedAt != null`

3. **Restore:**
   - POST `/api/trash/files/:id/restore` sets `deletedAt: null`
   - Folder restore recursively restores all contents

4. **Permanent Delete:**
   - DELETE `/api/trash/files/:id/permanent` removes from storage + database
   - Folder permanent delete cascades to all contents

5. **Auto-Cleanup (Planned):**
   - Cron job to delete items older than `TRASH_RETENTION_DAYS` (default: 30)

**Database Queries:**
```javascript
// Active items only
File.find({ ownerId: userId, deletedAt: null })

// Trashed items only
File.find({ ownerId: userId, deletedAt: { $ne: null } })
```

---

## Security Features

### Authentication & Authorization
- ✅ JWT-based authentication with 7-day expiry
- ✅ bcrypt password hashing (12 rounds)
- ✅ Owner-based access control (users can only access their own data)
- ✅ Protected routes with auth middleware

### Input Validation
- ✅ Email format validation
- ✅ Password strength requirements (min 6 chars)
- ✅ File size limits (max 100MB)
- ✅ Filename sanitization
- ✅ MIME type validation

### API Security
- ✅ CORS configuration with allowed origins
- ✅ Helmet.js security headers
- ✅ Request size limits
- ✅ Error message sanitization (no stack traces in production)

### File Security
- ✅ Unique file names to prevent collisions
- ✅ Owner verification on all file operations
- ✅ Storage key obfuscation (not exposed to client)
- ✅ Public share IDs use UUIDv4 (non-guessable)

---

## Error Handling

All errors return JSON with appropriate HTTP status codes:

```json
{
  "error": "Error message here"
}
```

**Status Codes:**
- `400` - Bad request / validation error / missing parameters
- `401` - Unauthorized / invalid or missing token
- `403` - Forbidden / access denied to resource
- `404` - Resource not found (folder, file, user)
- `500` - Internal server error

**Common Errors:**
```json
// Invalid credentials
{ "error": "Invalid credentials" }

// Unauthorized access
{ "error": "Not authorized to access this folder" }

// File too large
{ "error": "File size exceeds 100MB limit" }

// Validation error
{ "error": "Email is required" }
```

---

## Project Structure

```
backend/
├── app.js                      # Express app entry point
├── middleware/
│   └── auth.js                 # JWT authentication middleware
├── models/
│   ├── User.js                 # User model with password hashing
│   ├── Folder.js               # Folder model with virtuals & soft delete
│   └── File.js                 # File model with soft delete
├── routes/
│   ├── auth.js                 # Authentication endpoints (register, login)
│   ├── folders.js              # Folder management endpoints
│   ├── files.js                # File upload/download endpoints
│   ├── trash.js                # Trash management endpoints
│   ├── search.js               # Search endpoints
│   └── public.js               # Public sharing endpoints
├── storage/
│   ├── index.js                # Storage factory (singleton)
│   ├── StorageProvider.js      # Base class interface
│   ├── LocalStorageProvider.js # Local disk implementation
│   └── S3StorageProvider.js    # S3/MinIO implementation
├── utils/
│   └── validators.js           # Input validation helpers
├── .env.example                # Environment template
├── .gitignore                  # Git ignore rules
├── Dockerfile                  # Docker build configuration
├── vercel.json                 # Vercel serverless config
├── package.json                # Dependencies and scripts
└── README.md                   # This file
```

---

## Dependencies

### Production

| Package | Version | Purpose |
|---------|---------|---------|
| `express` | ^5.0.1 | Web framework |
| `mongoose` | ^9.0.0 | MongoDB ODM |
| `bcryptjs` | ^2.4.3 | Password hashing |
| `jsonwebtoken` | ^9.0.2 | JWT authentication |
| `multer` | ^1.4.5 | File upload handling |
| `cors` | ^2.8.5 | Cross-origin requests |
| `dotenv` | ^16.4.7 | Environment variables |
| `helmet` | ^8.0.0 | Security headers |
| `@aws-sdk/client-s3` | ^3.712.0 | S3 storage provider |
| `uuid` | ^11.0.5 | UUID generation for share links |

### Development

| Package | Purpose |
|---------|---------|
| `nodemon` | Auto-reload on file changes |

---

## Scripts

```bash
npm start       # Production: node app.js
npm run dev     # Development: nodemon app.js (auto-reload)
npm test        # Run tests (if configured)
```

---

## Docker

### Build and Run

```bash
# Build image
docker build -t opendrive-backend .

# Run with environment file
docker run -p 5000:5000 --env-file .env opendrive-backend

# Run with inline env vars
docker run -p 5000:5000 \
  -e MONGODB_URI=mongodb://host.docker.internal:27017/drive \
  -e JWT_SECRET=your-secret-key \
  -e STORAGE_PROVIDER=local \
  opendrive-backend
```

### Docker Compose

```yaml
version: '3.8'
services:
  backend:
    build: .
    ports:
      - "5000:5000"
    environment:
      - MONGODB_URI=mongodb://mongo:27017/drive
      - JWT_SECRET=your-secret-key
      - STORAGE_PROVIDER=local
    volumes:
      - ./uploads:/app/uploads
    depends_on:
      - mongo

  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

volumes:
  mongo_data:
```

---

## Deployment

### Vercel Serverless

The backend is configured for Vercel serverless deployment via `vercel.json`:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

**Environment Variables (Vercel Dashboard):**
- `MONGODB_URI` - MongoDB Atlas connection string
- `JWT_SECRET` - Secret key for JWT
- `STORAGE_PROVIDER` - Set to `s3` for serverless
- `S3_*` - S3 configuration for file storage

**Note:** Local storage doesn't work on Vercel (ephemeral filesystem). Use S3-compatible storage.

### Traditional Server (PM2)

```bash
# Install PM2
npm i -g pm2

# Start app
pm2 start app.js --name opendrive-backend

# Monitor
pm2 status
pm2 logs opendrive-backend

# Auto-restart on reboot
pm2 startup
pm2 save
```

### Docker Deployment

```bash
# Build and push to registry
docker build -t your-registry/opendrive-backend:latest .
docker push your-registry/opendrive-backend:latest

# Deploy on server
docker pull your-registry/opendrive-backend:latest
docker run -d -p 5000:5000 --env-file .env your-registry/opendrive-backend:latest
```

---

## API Testing

### Using cURL

```bash
# Register user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Get folders (with auth)
curl http://localhost:5000/api/folders \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Upload file
curl -X POST http://localhost:5000/api/files \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@/path/to/file.pdf" \
  -F "folderId=FOLDER_ID"
```

### Using Postman

1. Import endpoints from the API documentation above
2. Create environment variable for `baseUrl` and `token`
3. Add `Authorization: Bearer {{token}}` header to protected requests

---

## Performance Considerations

### Database Optimization
- ✅ Indexes on frequently queried fields (`ownerId`, `deletedAt`, `shareId`)
- ✅ Text indexes for search functionality
- ✅ Compound indexes for combined queries
- ✅ Virtual populate for related data (avoid N+1 queries)

### File Upload/Download
- ✅ Streaming for large files (no memory buffering)
- ✅ Multer memory storage with immediate write to disk/S3
- ✅ 100MB file size limit to prevent abuse
- ✅ MIME type validation

### Scalability
- ✅ Stateless design (horizontal scaling possible)
- ✅ JWT tokens (no server-side session storage)
- ✅ S3 storage for distributed deployments
- ⚠️ Add Redis for rate limiting and caching (future)
- ⚠️ Add CDN for file downloads (future)

---

## Monitoring & Logging

### Recommended Setup

1. **Application Monitoring:** Use PM2, New Relic, or Datadog
2. **Database Monitoring:** MongoDB Atlas built-in monitoring
3. **Error Tracking:** Sentry for error reporting
4. **Logging:** Winston or Pino for structured logging

### Health Check

```bash
# Check API health
curl http://localhost:5000/api/health

# Response
{
  "status": "ok",
  "database": "connected",
  "storage": "local",
  "uptime": 3600
}
```

---

## Troubleshooting

### MongoDB Connection Fails

```bash
# Check MongoDB is running
mongosh mongodb://localhost:27017

# Verify connection string format
# Local: mongodb://localhost:27017/drive
# Atlas: mongodb+srv://user:pass@cluster.mongodb.net/drive
```

### File Upload Fails

- Check `MAX_FILE_SIZE` environment variable
- Verify storage directory permissions (for local storage)
- Check S3 credentials and bucket permissions (for S3 storage)
- Ensure CORS is configured correctly

### JWT Token Invalid

- Verify `JWT_SECRET` is set and consistent
- Check token expiry (7 days by default)
- Ensure `Authorization: Bearer TOKEN` header format is correct

---

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## License

This project is licensed under the **AGPL-3.0** license. See the root [LICENSE](../LICENSE) file for details.

---

## Support

For issues, questions, or contributions:
- Open an issue on GitHub
- Check existing documentation
- Review API examples above
