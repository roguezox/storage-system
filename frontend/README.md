# Storage Platform Frontend

A Next.js application providing a modern, responsive UI for the cloud storage platform.

## 🚀 Live Demo

**App URL:** https://storage-system-sooty.vercel.app/

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **State Management:** Zustand
- **HTTP Client:** Axios
- **Styling:** Custom CSS Design System
- **Deployment:** Vercel

## Quick Start

```bash
# Install dependencies
npm install

# Create .env.local file
echo "NEXT_PUBLIC_API_URL=http://localhost:5000" > .env.local

# Start development server
npm run dev
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:5000` |

## Pages

| Route | Description |
|-------|-------------|
| `/` | Home - redirects based on auth |
| `/login` | Login page |
| `/register` | Registration page |
| `/dashboard` | User dashboard overview |
| `/folders` | All root folders view |
| `/folders/[id]` | Folder contents view |
| `/public/[shareId]` | Public shared content view |

## Features

### Authentication
- JWT-based authentication
- Persistent login via cookies
- Protected route handling
- Auto-redirect for unauthenticated users

### Folder Management
- Create, rename, delete folders
- Nested folder navigation
- Breadcrumb navigation
- Share folders with public links

### File Management
- Upload files to folders
- Download files
- Rename, delete files
- Share files with public links
- Files stored in MongoDB (up to 16MB)

### Sharing
- Generate shareable links for folders/files
- Navigate through shared folder hierarchy
- Download files from shared folders
- Revoke share access anytime

## State Management

Using Zustand for lightweight state management:

```typescript
// Auth Store
const useAuthStore = create((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  login: async (email, password) => {...},
  logout: () => {...},
  checkAuth: () => {...}
}));
```

## API Client

Axios instance with interceptors for:
- Auto-attach JWT token to requests
- Handle 401 errors (redirect to login)
- Base URL configuration

```typescript
import { authAPI, foldersAPI, filesAPI, publicAPI } from '@/lib/api';

// Examples
await authAPI.login(email, password);
await foldersAPI.getAll();
await filesAPI.upload(formData);
await publicAPI.getShared(shareId);
await publicAPI.getSubfolder(shareId, folderId);
```

## Key Components

| Component | Description |
|-----------|-------------|
| `AuthProvider` | Wraps app, handles auth state |
| `DashboardLayout` | Layout with sidebar & header |
| `Sidebar` | Navigation sidebar |
| `FolderCard` | Folder display with actions |
| `FileCard` | File display with download |
| `Modal` | Reusable modal component |
| `Button` | Styled button variants |
| `Input` | Form input with label |
| `Breadcrumb` | Navigation breadcrumbs |

## Styling

Custom CSS design system with:
- CSS variables for theming
- Dark mode support
- Responsive breakpoints
- Minimal, professional aesthetic

Key CSS variables:
```css
--accent: #2563eb;
--bg-primary: #ffffff;
--bg-secondary: #f9fafb;
--text-primary: #111827;
--text-muted: #6b7280;
--border: #e5e7eb;
```

## Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   ├── login/
│   │   ├── register/
│   │   ├── dashboard/
│   │   ├── folders/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   └── public/
│   │       └── [shareId]/page.tsx
│   ├── components/
│   │   ├── ui/
│   │   ├── layouts/
│   │   ├── FolderCard.tsx
│   │   ├── FileCard.tsx
│   │   └── ...
│   ├── stores/
│   │   └── authStore.ts
│   └── lib/
│       └── api.ts
├── vercel.json
└── package.json
```

## Dependencies

- `next` - React framework
- `react` - UI library
- `typescript` - Type safety
- `zustand` - State management
- `axios` - HTTP client
- `js-cookie` - Cookie handling
- `react-icons` - Icon library
