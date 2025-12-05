# Storage Platform

A full-stack storage platform (like a simplified Google Drive) built for managing folders, files, and sharing.

---

## Live Demo

Start both servers and visit `http://localhost:3000`.

**Test credentials** (after registering):
- Email: any email you register
- Password: your chosen password

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript |
| Backend | Node.js, Express 5 |
| Database | MongoDB (Atlas) |
| Auth | JWT (jsonwebtoken + bcrypt) |
| State | Zustand |
| Styling | Custom CSS (design system) |

---

## Features

### For Admins (Logged In)
- 📁 Create, rename, delete folders
- 📁 Nest folders infinitely
- 📄 Upload files to any folder
- 📄 Rename, delete files
- 🔗 Share folders/files via public link
- 🔒 Revoke share links anytime

### For Public (No Login)
- 👁️ View shared folders/files
- ⬇️ Download shared files
- 🚫 No edit/delete access

---

## Project Structure

```
drive/
├── backend/           # Express API
│   ├── models/        # MongoDB schemas
│   ├── routes/        # API endpoints
│   ├── middleware/    # JWT auth
│   └── uploads/       # File storage
│
└── frontend/          # Next.js app
    ├── src/app/       # Pages (App Router)
    ├── src/components/
    ├── src/lib/       # API client
    └── src/stores/    # State management
```

---

## Getting Started

### 1. Backend

```bash
cd backend
npm install
npm run dev
```

Runs on `http://localhost:5000`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:3000`

---

## Environment Setup

### Backend `.env`

```
MONGO_URI=mongodb+srv://...your-connection-string
JWT_SECRET=any-secret-key
PORT=5000
```

### Frontend `.env.local` (optional)

```
NEXT_PUBLIC_API_URL=http://localhost:5000
```

---

## API Summary

| Endpoint | Auth | Description |
|----------|------|-------------|
| POST `/api/auth/register` | No | Create user |
| POST `/api/auth/login` | No | Get JWT token |
| GET `/api/folders` | Yes | List root folders |
| POST `/api/folders` | Yes | Create folder |
| DELETE `/api/folders/:id` | Yes | Delete folder |
| POST `/api/files` | Yes | Upload file |
| GET `/api/public/:shareId` | No | Access shared item |

Full API docs in [backend/README.md](./backend/README.md).


