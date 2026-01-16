# OpenDrive Backend

A Node.js/Express REST API for a self-hosted cloud storage platform with user authentication, folder/file management, pluggable storage backends (local disk, GCS, or S3-compatible), public sharing capabilities, and soft delete with trash/restore functionality.

---

## Tech Stack

| Category | Technology |
|----------|------------|
| **Runtime** | Node.js 20+ |
| **Framework** | Express.js 5 |
| **Database** | MongoDB with Mongoose 9 ODM |
| **Authentication** | JWT with bcrypt |
| **File Storage** | Pluggable: Local Disk, GCS, or S3/MinIO |
| **File Uploads** | Multer (memory storage, up to 100MB) |
| **Security** | Helmet, CORS, Rate Limiting |
| **Logging** | Winston with optional Kafka integration |

---

## Architecture

```
                    +------------------------------------------+
                    |              Express Server              |
                    +------------------------------------------+
                              |                    |
                    +---------+----------+   +-----+------+
                    |   Routes Layer     |   | Middleware |
                    |                    |   |            |
                    | - /api/auth        |   | - auth.js  |
                    | - /api/folders     |   | - cors     |
                    | - /api/files       |   | - helmet   |
                    | - /api/trash       |   | - upload   |
                    | - /api/search      |   +------------+
                    | - /api/public      |
                    +--------------------+
                              |
                    +--------------------+
                    |   Controllers      |
                    +--------------------+
                              |
          +-------------------+-------------------+
          |                   |                   |
    +-----+-----+       +-----+-----+       +-----+-----+
    |   Models  |       |  Storage  |       |  Logger   |
    |           |       |  Provider |       |           |
    | - User    |       |           |       | - Console |
    | - Folder  |       | - Local   |       | - Kafka   |
    | - File    |       | - GCS     |       |           |
    |           |       | - S3      |       |           |
    +-----------+       +-----------+       +-----------+
          |                   |
          v                   v
    +-----------+       +-----------+
    |  MongoDB  |       |  Storage  |
    |           |       |  Backend  |
    +-----------+       +-----------+
```

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

The server starts on `http://localhost:5000`.

---

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/drive` |
| `JWT_SECRET` | Secret key for JWT signing (min 32 chars) | `openssl rand -hex 32` |
| `PORT` | Server port | `5000` |

### Storage Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `STORAGE_PROVIDER` | Storage backend: `local`, `gcs`, or `s3` | `local` |
| `STORAGE_PATH` | Path for local storage | `./uploads` |

### GCS Settings (when `STORAGE_PROVIDER=gcs`)

| Variable | Description |
|----------|-------------|
| `GCS_PROJECT_ID` | GCP project ID |
| `GCS_BUCKET` | GCS bucket name |
| `GCS_KEYFILE` | Path to service account JSON key |

### S3/MinIO Settings (when `STORAGE_PROVIDER=s3`)

| Variable | Description |
|----------|-------------|
| `S3_ENDPOINT` | S3 endpoint URL (empty for AWS S3) |
| `S3_BUCKET` | Bucket name |
| `S3_REGION` | AWS region |
| `S3_ACCESS_KEY` | Access key ID |
| `S3_SECRET_KEY` | Secret access key |

### Kafka Logging (Optional)

| Variable | Description |
|----------|-------------|
| `KAFKA_BOOTSTRAP_SERVERS` | Confluent Cloud bootstrap servers |
| `KAFKA_API_KEY` | API key |
| `KAFKA_API_SECRET` | API secret |
| `KAFKA_TOPIC` | Log topic name |
| `LOG_LEVEL` | Logging level: `debug`, `info`, `warn`, `error` |

### Optional Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `CORS_ORIGIN` | Allowed CORS origin | `*` |
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
| POST | `/api/auth/register` | Register new user | No |
| POST | `/api/auth/login` | Login and get JWT token | No |
| GET | `/api/auth/me` | Get current user | Yes |

### Folders

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/folders` | Get all root folders | Yes |
| GET | `/api/folders/stats/summary` | Get user stats | Yes |
| GET | `/api/folders/:id` | Get folder with contents | Yes |
| POST | `/api/folders` | Create new folder | Yes |
| PUT | `/api/folders/:id` | Rename folder | Yes |
| DELETE | `/api/folders/:id` | Soft delete folder | Yes |
| POST | `/api/folders/:id/share` | Generate share link | Yes |
| DELETE | `/api/folders/:id/share` | Revoke share link | Yes |

### Files

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/files/folder/:folderId` | Get files in folder | Yes |
| POST | `/api/files` | Upload file (multipart/form-data) | Yes |
| GET | `/api/files/:id/download` | Download file | Yes |
| PUT | `/api/files/:id` | Rename file | Yes |
| DELETE | `/api/files/:id` | Soft delete file | Yes |
| POST | `/api/files/:id/share` | Generate share link | Yes |
| DELETE | `/api/files/:id/share` | Revoke share link | Yes |

### Trash

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/trash/files` | Get trashed files | Yes |
| GET | `/api/trash/folders` | Get trashed folders | Yes |
| POST | `/api/trash/files/:id/restore` | Restore file | Yes |
| POST | `/api/trash/folders/:id/restore` | Restore folder | Yes |
| DELETE | `/api/trash/files/:id/permanent` | Permanently delete file | Yes |
| DELETE | `/api/trash/folders/:id/permanent` | Permanently delete folder | Yes |
| POST | `/api/trash/empty` | Empty entire trash | Yes |

### Search

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/search?q=query&type=all` | Search files and folders | Yes |

### Public Access

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/public/:shareId` | Get shared folder/file info | No |
| GET | `/api/public/:shareId/download` | Download shared file | No |

---

## Database Models

### User

```javascript
{
  email: String,        // unique, validated
  password: String,     // hashed with bcrypt
  role: String,         // 'admin' | 'user'
  createdAt: Date,
  updatedAt: Date
}
```

### Folder

```javascript
{
  name: String,         // max 255 chars
  parentId: ObjectId,   // ref: Folder (null for root)
  ownerId: ObjectId,    // ref: User
  path: String,         // e.g., "/Documents/Projects/"
  isShared: Boolean,
  shareId: String,      // UUID when shared
  deletedAt: Date,      // null for active
  createdAt: Date,
  updatedAt: Date
}
```

### File

```javascript
{
  name: String,           // unique generated name
  originalName: String,   // user's filename
  folderId: ObjectId,     // ref: Folder
  ownerId: ObjectId,      // ref: User
  storageKey: String,     // storage reference
  storageProvider: String,// 'local' | 'gcs' | 's3'
  mimeType: String,
  size: Number,           // bytes
  isShared: Boolean,
  shareId: String,
  deletedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

---

## Storage Providers

### Local Storage (Default)

Files stored on local filesystem.

```env
STORAGE_PROVIDER=local
STORAGE_PATH=./uploads
```

### Google Cloud Storage

```env
STORAGE_PROVIDER=gcs
GCS_PROJECT_ID=your-project
GCS_BUCKET=your-bucket
GCS_KEYFILE=/path/to/keyfile.json
```

### S3-Compatible (AWS, MinIO, R2)

```env
STORAGE_PROVIDER=s3
S3_ENDPOINT=http://localhost:9000  # Empty for AWS
S3_BUCKET=drive
S3_REGION=us-east-1
S3_ACCESS_KEY=your_access_key
S3_SECRET_KEY=your_secret_key
```

---

## Project Structure

```
backend/
├── src/
│   ├── config/             # Configuration files
│   │   └── database.js
│   ├── controllers/        # Route handlers
│   │   ├── authController.js
│   │   ├── folderController.js
│   │   ├── fileController.js
│   │   └── trashController.js
│   ├── middleware/         # Express middleware
│   │   └── auth.js
│   ├── models/             # Mongoose models
│   │   ├── User.js
│   │   ├── Folder.js
│   │   └── File.js
│   ├── routes/             # API routes
│   │   ├── auth.js
│   │   ├── folders.js
│   │   ├── files.js
│   │   ├── trash.js
│   │   ├── search.js
│   │   └── public.js
│   ├── storage/            # Storage providers
│   │   ├── index.js
│   │   ├── StorageProvider.js
│   │   ├── LocalStorageProvider.js
│   │   ├── GCSStorageProvider.js
│   │   └── S3StorageProvider.js
│   ├── utils/              # Utilities
│   │   ├── logger.js
│   │   └── validators.js
│   └── server.js           # Entry point
├── .env.example
├── Dockerfile
└── package.json
```

---

## Scripts

```bash
npm start       # Production server
npm run dev     # Development with hot reload
npm run build   # Build TypeScript (if applicable)
npm test        # Run tests
```

---

## Docker

### Build and Run

```bash
# Build image
docker build -t opendrive-backend .

# Run with environment file
docker run -p 5000:5000 --env-file .env opendrive-backend
```

### Docker Compose

```yaml
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
    volumes:
      - mongo_data:/data/db

volumes:
  mongo_data:
```

---

## Security Features

- JWT-based authentication with 7-day expiry
- bcrypt password hashing (12 rounds)
- Owner-based access control
- Input validation and sanitization
- Helmet.js security headers
- CORS configuration
- File size limits
- MIME type validation

---

## Error Handling

All errors return JSON with appropriate HTTP status codes:

```json
{
  "error": "Error message"
}
```

| Status | Description |
|--------|-------------|
| `400` | Bad request / validation error |
| `401` | Unauthorized / invalid token |
| `403` | Forbidden / access denied |
| `404` | Resource not found |
| `413` | File too large |
| `500` | Internal server error |

---

## License

AGPL-3.0. See [LICENSE](../LICENSE) for details.
