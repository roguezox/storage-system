# Storage Platform - Backend

A Node.js/Express API for a simplified internal "drive" storage system.

---

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The server runs on `http://localhost:5000`.

---

## Project Structure

```
backend/
├── app.js              # Main entry point
├── models/
│   ├── User.js         # User schema (auth)
│   ├── Folder.js       # Folder schema
│   └── File.js         # File schema
├── routes/
│   ├── auth.js         # Login/Register endpoints
│   ├── folders.js      # Folder CRUD + sharing
│   ├── files.js        # File upload + CRUD
│   └── public.js       # Public share access
├── middleware/
│   └── auth.js         # JWT verification
└── uploads/            # Uploaded files storage
```

---

## Environment Variables

Create a `.env` file:

```
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=any_secret_key_you_want
PORT=5000
```

---

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create new user |
| POST | `/api/auth/login` | Login, get JWT token |
| GET | `/api/auth/me` | Get current user |

**Request body for register/login:**
```json
{
  "email": "user@example.com",
  "password": "yourpassword"
}
```

---

### Folders

All folder routes require `Authorization: Bearer <token>` header.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/folders` | Get all root folders |
| GET | `/api/folders/:id` | Get folder with subfolders & files |
| POST | `/api/folders` | Create folder |
| PUT | `/api/folders/:id` | Rename folder |
| DELETE | `/api/folders/:id` | Delete folder (cascades) |
| POST | `/api/folders/:id/share` | Generate share link |
| DELETE | `/api/folders/:id/share` | Revoke share link |

**Create folder:**
```json
{
  "name": "My Folder",
  "parentId": "optional_parent_folder_id"
}
```

---

### Files

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/files/folder/:folderId` | Get files in folder |
| POST | `/api/files` | Upload file (multipart/form-data) |
| PUT | `/api/files/:id` | Rename file |
| DELETE | `/api/files/:id` | Delete file |
| POST | `/api/files/:id/share` | Generate share link |
| DELETE | `/api/files/:id/share` | Revoke share link |

**Upload file:**
- Use `multipart/form-data`
- Fields: `file` (the file) + `folderId` (target folder)

---

### Public Access

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/public/:shareId` | Get shared folder/file (no auth) |

Returns folder contents or file details for anyone with the share link.

---

## Database Models

### User
```javascript
{
  email: String,
  password: String,  // Hashed with bcrypt
  role: 'admin',
  createdAt: Date
}
```

### Folder
```javascript
{
  name: String,
  parentId: ObjectId | null,  // null = root folder
  ownerId: ObjectId,
  path: String,               // e.g., "/Projects/Design/"
  isShared: Boolean,
  shareId: String | null,
  createdAt: Date
}
```

### File
```javascript
{
  name: String,
  originalName: String,
  folderId: ObjectId,
  ownerId: ObjectId,
  url: String,           // Local path like "/uploads/abc123.pdf"
  mimeType: String,
  size: Number,
  isShared: Boolean,
  shareId: String | null,
  createdAt: Date
}
```

---

## How Authentication Works

1. User registers or logs in → server returns a JWT token
2. Frontend stores this token (in cookies)
3. Every API request includes `Authorization: Bearer <token>`
4. Middleware decodes the token and attaches `req.userId`
5. Routes use `req.userId` to scope data to that user

---

## How Sharing Works

1. User clicks "Share" on a folder/file
2. Backend generates a UUID (`shareId`) and saves it
3. Frontend copies `https://your-app.com/public/{shareId}`
4. Anyone with that URL can access `/api/public/{shareId}`
5. User can "Unshare" to remove the `shareId`

---

## Error Handling

All errors return JSON:

```json
{
  "error": "Human-readable error message"
}
```

Common status codes:
- `400` - Bad request (missing fields)
- `401` - Unauthorized (invalid/missing token)
- `404` - Not found
- `500` - Server error

---

## What I'd Improve With More Time

- Add rate limiting
- Add file type validation
- Add storage quota per user
- Add folder/file move functionality
- Add pagination for large folders
- Add real file previews (images, PDFs)
- Write automated tests

---

## Dependencies

- `express` - Web framework
- `mongoose` - MongoDB ODM
- `bcryptjs` - Password hashing
- `jsonwebtoken` - JWT auth
- `multer` - File uploads
- `cors` - Cross-origin requests
- `dotenv` - Environment variables
- `uuid` - Generate share IDs
