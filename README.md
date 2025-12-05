# Storage Platform

A full-stack cloud storage application with folder management, file uploads, and sharing capabilities.

## 🚀 Live Demo

- **Frontend:** [Your Vercel Frontend URL]
- **Backend:** [Your Vercel Backend URL]

## 📋 Features

- **User Authentication** - Register, login, JWT-based sessions
- **Folder Management** - Create, rename, delete, nested folders
- **File Management** - Upload, download, rename, delete files
- **Sharing** - Generate public links for folders/files
- **Public Access** - Navigate shared folders, download files
- **Responsive Design** - Works on desktop and mobile

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, TypeScript, Zustand |
| Backend | Express.js 5, Node.js |
| Database | MongoDB Atlas |
| File Storage | MongoDB (base64) |
| Deployment | Vercel |

## 📁 Project Structure

```
drive/
├── backend/           # Express.js API
│   ├── models/        # Mongoose schemas
│   ├── routes/        # API routes
│   ├── middleware/    # Auth middleware
│   └── app.js         # Entry point
├── frontend/          # Next.js app
│   └── src/
│       ├── app/       # Pages (App Router)
│       ├── components/# React components
│       ├── stores/    # Zustand stores
│       └── lib/       # API client
└── README.md
```

## 🏃 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB Atlas account

### Backend Setup

```bash
cd drive/backend
npm install

# Create .env file
echo "MONGODB_URI=your_mongodb_uri" > .env
echo "JWT_SECRET=your_secret" >> .env
echo "PORT=5000" >> .env

npm run dev
```

### Frontend Setup

```bash
cd drive/frontend
npm install

# Create .env.local file
echo "NEXT_PUBLIC_API_URL=http://localhost:5000" > .env.local

npm run dev
```

## 🔌 API Summary

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/register` | Create account |
| `POST /api/auth/login` | Get JWT token |
| `GET /api/folders` | List root folders |
| `GET /api/folders/:id` | Get folder contents |
| `POST /api/folders` | Create folder |
| `POST /api/files` | Upload file |
| `GET /api/files/:id/download` | Download file |
| `POST /api/folders/:id/share` | Share folder |
| `GET /api/public/:shareId` | Access shared content |

## 🔒 Environment Variables

### Backend
```
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-secret-key
PORT=5000
```

### Frontend
```
NEXT_PUBLIC_API_URL=http://localhost:5000
```

## 📝 What I'd Add With More Time

- [ ] Drag-and-drop file uploads
- [ ] File preview (images, PDFs)
- [ ] Search functionality
- [ ] Bulk operations (multi-select delete)
- [ ] Storage quota management
- [ ] File versioning
- [ ] Collaborative features
- [ ] External storage (S3/Cloudinary) for larger files

