# Storage Platform Backend

A Node.js/Express REST API for a cloud storage platform with user authentication, folder/file management, and sharing capabilities.

## 🚀 Live Demo

**API URL:** https://storage-system-uysk.vercel.app/

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js 5
- **Database:** MongoDB with Mongoose ODM
- **Authentication:** JWT (JSON Web Tokens)
- **File Storage:** MongoDB (base64 encoded)
- **Deployment:** Vercel Serverless

## Quick Start

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Start development server
npm run dev
```

## Environment Variables

Create a `.env` file:

```
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=any_secret_key_you_want
PORT=5000
```

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login and get JWT token |
| GET | `/api/auth/me` | Get current user info |

### Folders

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/folders` | Get all root folders |
| GET | `/api/folders/:id` | Get folder with subfolders & files |
| POST | `/api/folders` | Create new folder |
| PUT | `/api/folders/:id` | Rename folder |
| DELETE | `/api/folders/:id` | Delete folder (cascade) |
| POST | `/api/folders/:id/share` | Generate share link |
| DELETE | `/api/folders/:id/share` | Revoke share link |

### Files

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/files/folder/:folderId` | Get files in folder |
| POST | `/api/files` | Upload file (multipart/form-data) |
| GET | `/api/files/:id/download` | Download file |
| PUT | `/api/files/:id` | Rename file |
| DELETE | `/api/files/:id` | Delete file |
| POST | `/api/files/:id/share` | Generate share link |
| DELETE | `/api/files/:id/share` | Revoke share link |

### Public (No Auth Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/public/:shareId` | Get shared folder/file info |
| GET | `/api/public/:shareId/folder/:folderId` | Navigate into subfolder |
| GET | `/api/public/:shareId/file/:fileId/download` | Download file from shared folder |
| GET | `/api/public/:shareId/download` | Download directly shared file |

## Database Models

### User
```javascript
{
  email: String (unique, required),
  password: String (hashed, required),
  role: String (default: 'admin'),
  createdAt: Date
}
```

### Folder
```javascript
{
  name: String (required),
  parentId: ObjectId (ref: Folder, null for root),
  ownerId: ObjectId (ref: User, required),
  path: String (e.g., "/Documents/Projects/"),
  isShared: Boolean (default: false),
  shareId: String (UUID when shared),
  createdAt: Date
}
```

### File
```javascript
{
  name: String (required),
  originalName: String,
  folderId: ObjectId (ref: Folder, required),
  ownerId: ObjectId (ref: User, required),
  data: String (base64 encoded file content),
  mimeType: String,
  size: Number (bytes),
  isShared: Boolean (default: false),
  shareId: String (UUID when shared),
  createdAt: Date
}
```

## File Storage

Files are stored directly in MongoDB as base64-encoded strings. This approach:
- ✅ Works with serverless environments (Vercel)
- ✅ No external storage service needed
- ⚠️ Limited to 16MB per file (MongoDB document limit)

## Authentication Flow

1. User registers/logs in → receives JWT token
2. Token stored in `Authorization: Bearer <token>` header
3. Auth middleware validates token on protected routes
4. Token expires after 7 days

## Sharing Mechanism

1. User calls `/share` endpoint on folder/file
2. System generates unique UUID (`shareId`)
3. Public can access via `/api/public/:shareId`
4. For shared folders, users can navigate subfolders and download files
5. User can revoke access by calling DELETE `/share`

## Error Handling

All errors return JSON:
```json
{
  "error": "Error message here"
}
```

Common status codes:
- `400` - Bad request / validation error
- `401` - Unauthorized / invalid token
- `404` - Resource not found
- `500` - Server error

## Project Structure

```
backend/
├── models/
│   ├── User.js
│   ├── Folder.js
│   └── File.js
├── routes/
│   ├── auth.js
│   ├── folders.js
│   ├── files.js
│   └── public.js
├── middleware/
│   └── auth.js
├── app.js
├── vercel.json
└── package.json
```

## Dependencies

- `express` - Web framework
- `mongoose` - MongoDB ODM
- `bcryptjs` - Password hashing
- `jsonwebtoken` - JWT authentication
- `multer` - File upload handling
- `cors` - Cross-origin requests
- `dotenv` - Environment variables
