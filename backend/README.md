# OpenDrive Backend

A Node.js/Express REST API for a self-hosted cloud storage platform with user authentication, folder/file management, pluggable storage backends (local disk or S3-compatible), and public sharing capabilities.

## 🚀 Live Demo

**API URL:** https://storage-system-uysk.vercel.app/

---

## Tech Stack

| Category | Technology |
|----------|------------|
| **Runtime** | Node.js 20+ |
| **Framework** | Express.js 5 |
| **Database** | MongoDB with Mongoose 9 ODM |
| **Authentication** | JWT (JSON Web Tokens) |
| **File Storage** | Pluggable: Local Disk or S3/MinIO |
| **File Uploads** | Multer (memory storage, up to 100MB) |
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
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/drive` |
| `JWT_SECRET` | Secret key for JWT signing | `your-super-secret-key` |
| `PORT` | Server port | `5000` |

### Storage Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `STORAGE_PROVIDER` | Storage backend: `local` or `s3` | `local` |
| `STORAGE_PATH` | Path for local storage | `./uploads` |

### S3/MinIO Settings (when `STORAGE_PROVIDER=s3`)

| Variable | Description |
|----------|-------------|
| `S3_ENDPOINT` | S3 endpoint URL (empty for AWS S3) |
| `S3_BUCKET` | Bucket name |
| `S3_REGION` | AWS region |
| `S3_ACCESS_KEY` | Access key ID |
| `S3_SECRET_KEY` | Secret access key |

---

## API Endpoints

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | API status |
| GET | `/api/health` | Health check |

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user (returns JWT) |
| POST | `/api/auth/login` | Login and get JWT token |
| GET | `/api/auth/me` | Get current authenticated user |

### Folders (Protected)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/folders` | Get all root folders |
| GET | `/api/folders/stats/summary` | Get user stats (folder count, storage used) |
| GET | `/api/folders/:id` | Get folder with subfolders, files & breadcrumb |
| POST | `/api/folders` | Create new folder |
| PUT | `/api/folders/:id` | Rename folder |
| DELETE | `/api/folders/:id` | Delete folder (cascade deletes contents) |
| POST | `/api/folders/:id/share` | Generate public share link |
| DELETE | `/api/folders/:id/share` | Revoke share link |

### Files (Protected)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/files/folder/:folderId` | Get files in a folder |
| POST | `/api/files` | Upload file (`multipart/form-data`) |
| GET | `/api/files/:id/download` | Download/view file |
| PUT | `/api/files/:id` | Rename file |
| DELETE | `/api/files/:id` | Delete file |
| POST | `/api/files/:id/share` | Generate public share link |
| DELETE | `/api/files/:id/share` | Revoke share link |

### Public Access (No Auth Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/public/:shareId` | Get shared folder/file info |
| GET | `/api/public/:shareId/folder/:folderId` | Navigate into shared subfolder |
| GET | `/api/public/:shareId/file/:fileId/download` | Download file from shared folder |
| GET | `/api/public/:shareId/download` | Download directly shared file |

---

## Database Models

### User

```javascript
{
  email: String,        // unique, required, lowercase
  password: String,     // hashed with bcrypt (12 rounds)
  role: String,         // 'admin' | 'user' (default: 'admin')
  createdAt: Date
}
```

### Folder

```javascript
{
  name: String,         // required, trimmed
  parentId: ObjectId,   // ref: Folder (null for root)
  ownerId: ObjectId,    // ref: User, required
  path: String,         // e.g., "/Documents/Projects/"
  isShared: Boolean,    // default: false
  shareId: String,      // UUID when shared (indexed)
  createdAt: Date
}
```

### File

```javascript
{
  name: String,           // unique generated name
  originalName: String,   // user's original filename
  folderId: ObjectId,     // ref: Folder, required
  ownerId: ObjectId,      // ref: User, required
  storageKey: String,     // reference to file in storage backend
  storageProvider: String,// 'local' | 's3'
  mimeType: String,
  size: Number,           // bytes
  isShared: Boolean,      // default: false
  shareId: String,        // UUID when shared (indexed)
  createdAt: Date
}
```

---

## Storage Providers

The backend supports pluggable storage backends via the `storage/` module:

### Local Storage (Default)

Files are stored on the local filesystem.

```env
STORAGE_PROVIDER=local
STORAGE_PATH=./uploads
```

**Pros:**
- ✅ Simple setup
- ✅ No external dependencies
- ✅ Fast for small deployments

### S3-Compatible Storage

Works with AWS S3, MinIO, Backblaze B2, DigitalOcean Spaces, etc.

```env
STORAGE_PROVIDER=s3
S3_ENDPOINT=http://minio:9000
S3_BUCKET=drive
S3_REGION=us-east-1
S3_ACCESS_KEY=your_key
S3_SECRET_KEY=your_secret
```

**Pros:**
- ✅ Scalable
- ✅ Works with cloud-native infrastructure
- ✅ Supports large files

---

## Authentication Flow

1. User registers or logs in → receives JWT token
2. Token is sent in `Authorization: Bearer <token>` header
3. Auth middleware validates token on protected routes
4. Token expires after **7 days**

---

## Sharing Mechanism

1. User calls `POST /:id/share` on a folder or file
2. System generates unique UUID (`shareId`)
3. Public can access via `/api/public/:shareId`
4. For shared folders, users can navigate into subfolders and download files
5. User can revoke access via `DELETE /:id/share`

---

## Error Handling

All errors return JSON:

```json
{
  "error": "Error message here"
}
```

**Status Codes:**
- `400` - Bad request / validation error
- `401` - Unauthorized / invalid token
- `403` - Forbidden / access denied
- `404` - Resource not found
- `500` - Server error

---

## Project Structure

```
backend/
├── app.js              # Express app entry point
├── middleware/
│   └── auth.js         # JWT authentication middleware
├── models/
│   ├── User.js         # User model with password hashing
│   ├── Folder.js       # Folder model with virtuals
│   └── File.js         # File model
├── routes/
│   ├── auth.js         # Authentication endpoints
│   ├── folders.js      # Folder management endpoints
│   ├── files.js        # File upload/download endpoints
│   └── public.js       # Public sharing endpoints
├── storage/
│   ├── index.js        # Storage factory (singleton)
│   ├── StorageProvider.js     # Base class interface
│   ├── LocalStorageProvider.js # Local disk implementation
│   └── S3StorageProvider.js   # S3/MinIO implementation
├── .env.example        # Environment template
├── Dockerfile          # Docker build
├── vercel.json         # Vercel serverless config
└── package.json
```

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `express` | Web framework |
| `mongoose` | MongoDB ODM |
| `bcryptjs` | Password hashing |
| `jsonwebtoken` | JWT authentication |
| `multer` | File upload handling |
| `cors` | Cross-origin requests |
| `dotenv` | Environment variables |
| `@aws-sdk/client-s3` | S3 storage provider |
| `uuid` | UUID generation |
| `nodemon` | Development auto-reload |

---

## Scripts

```bash
npm start     # Production: node app.js
npm run dev   # Development: nodemon app.js
```

---

## Docker

Build and run with Docker:

```bash
docker build -t opendrive-backend .
docker run -p 5000:5000 --env-file .env opendrive-backend
```

---

## License

This project is licensed under the **AGPL-3.0** license. See the root [LICENSE](../LICENSE) file for details.
