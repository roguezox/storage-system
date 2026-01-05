# OpenDrive Frontend

A modern, responsive Next.js application providing the user interface for the OpenDrive self-hosted cloud storage platform.

## 🚀 Live Demo

**App URL:** https://storage-system-sooty.vercel.app/

---

## Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript 5 |
| **React** | React 19 |
| **State Management** | Zustand 5 |
| **HTTP Client** | Axios |
| **Styling** | TailwindCSS 4 + Custom CSS Design System |
| **Deployment** | Vercel / Docker |

---

## Quick Start

```bash
# Install dependencies
npm install

# Create environment file
echo "NEXT_PUBLIC_API_URL=http://localhost:5000" > .env.local

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`.

> **Note:** Requires Node.js 20.9.0 or higher.

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:5000` |

For Docker deployments, the API URL can be configured at runtime.

---

## Application Routes

| Route | Description | Auth Required |
|-------|-------------|---------------|
| `/` | Home - redirects based on auth state | No |
| `/app/login` | Login page | No |
| `/app/register` | Registration page | No |
| `/app/dashboard` | User dashboard with stats | Yes |
| `/app/folders` | View all root folders | Yes |
| `/app/folders/[id]` | View folder contents (subfolders & files) | Yes |
| `/app/public/[shareId]` | View shared folder/file (public) | No |

---

## Features

### 🔐 Authentication
- JWT-based authentication via cookies
- Persistent login sessions (7-day expiry)
- Automatic redirect for unauthenticated users
- Protected route handling

### 📁 Folder Management
- Create, rename, and delete folders
- Nested folder navigation with breadcrumbs
- Share folders via public links
- View folder statistics (count, storage used)

### 📄 File Management
- Upload files to any folder (up to 100MB)
- Download files
- Rename and delete files
- Share individual files with public links
- Preview support for common file types

### 🔗 Public Sharing
- Generate shareable links for folders and files
- Navigate through shared folder hierarchy
- Download files from shared folders
- Revoke share access anytime

---

## State Management

The app uses **Zustand** for lightweight, performant state management.

### Auth Store (`src/stores/authStore.ts`)

```typescript
interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}
```

---

## API Client

The API client (`src/lib/api.ts`) provides typed wrappers for all backend endpoints with automatic JWT handling.

### Available API Modules

```typescript
import { authAPI, foldersAPI, filesAPI, publicAPI } from '@/lib/api';

// Authentication
await authAPI.login(email, password);
await authAPI.register(email, password);
await authAPI.getMe();

// Folders
await foldersAPI.getAll();
await foldersAPI.getById(id);
await foldersAPI.getStats();
await foldersAPI.create(name, parentId?);
await foldersAPI.rename(id, name);
await foldersAPI.delete(id);
await foldersAPI.share(id);
await foldersAPI.unshare(id);

// Files
await filesAPI.getByFolder(folderId);
await filesAPI.upload(folderId, file);
await filesAPI.rename(id, name);
await filesAPI.delete(id);
await filesAPI.share(id);
await filesAPI.unshare(id);

// Public Access
await publicAPI.getShared(shareId);
await publicAPI.getSubfolder(shareId, folderId);
```

### Interceptors
- **Request:** Automatically attaches JWT token from cookies
- **Response:** Handles 401 errors by clearing auth and redirecting to login

---

## Key Components

### Layout Components

| Component | Description |
|-----------|-------------|
| `DashboardLayout` | Main app layout with sidebar and header |
| `Sidebar` | Navigation sidebar with folder links |
| `Header` | Top header with user info and actions |
| `Breadcrumb` | Navigation breadcrumbs for folder paths |

### UI Components

| Component | Location | Description |
|-----------|----------|-------------|
| `FolderCard` | `src/components/FolderCard.tsx` | Folder display with actions (rename, share, delete) |
| `FileCard` | `src/components/FileCard.tsx` | File display with download, rename, share, delete |
| `Modal` | `src/components/ui/Modal.tsx` | Reusable modal dialog |
| `Button` | `src/components/ui/Button.tsx` | Styled button with variants |
| `Input` | `src/components/ui/Input.tsx` | Form input with label |

### Providers

| Provider | Description |
|----------|-------------|
| `AuthProvider` | Wraps app, initializes auth state on mount |

---

## Styling

The app uses a custom CSS design system with TailwindCSS integration.

### CSS Variables (Dark Mode Support)

```css
:root {
  --accent: #2563eb;
  --bg-primary: #ffffff;
  --bg-secondary: #f9fafb;
  --text-primary: #111827;
  --text-muted: #6b7280;
  --border: #e5e7eb;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #111827;
    --bg-secondary: #1f2937;
    --text-primary: #f9fafb;
    --text-muted: #9ca3af;
    --border: #374151;
  }
}
```

### Design Principles
- Clean, minimal aesthetic
- Responsive layouts for all screen sizes
- Dark mode support via CSS variables
- Consistent spacing and typography

---

## Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Home page (redirect logic)
│   │   ├── globals.css         # Global styles & CSS variables
│   │   └── app/
│   │       ├── login/          # Login page
│   │       ├── register/       # Registration page
│   │       ├── dashboard/      # Dashboard with stats
│   │       ├── folders/        # Folder views
│   │       │   ├── page.tsx    # Root folders list
│   │       │   └── [id]/       # Folder detail view
│   │       └── public/
│   │           └── [shareId]/  # Public shared content
│   ├── components/
│   │   ├── ui/                 # Base UI components
│   │   ├── layouts/            # Layout components
│   │   ├── providers/          # Context providers
│   │   ├── FolderCard.tsx      # Folder card component
│   │   ├── FileCard.tsx        # File card component
│   │   ├── Sidebar.tsx         # Navigation sidebar
│   │   ├── Header.tsx          # Page header
│   │   └── Breadcrumb.tsx      # Breadcrumb navigation
│   ├── stores/
│   │   └── authStore.ts        # Zustand auth store
│   └── lib/
│       ├── api.ts              # Axios API client
│       └── config.ts           # Runtime configuration
├── public/                     # Static assets
├── .env.example                # Environment template
├── Dockerfile                  # Docker build
├── next.config.ts              # Next.js configuration
├── tailwind.config.js          # TailwindCSS configuration
├── tsconfig.json               # TypeScript configuration
└── package.json
```

---

## Scripts

```bash
npm run dev     # Start development server
npm run build   # Build for production
npm start       # Start production server
npm run lint    # Run ESLint
```

---

## Dependencies

### Production

| Package | Purpose |
|---------|---------|
| `next` | React framework with App Router |
| `react` | UI library (v19) |
| `react-dom` | React DOM renderer |
| `typescript` | Type safety |
| `zustand` | State management |
| `axios` | HTTP client |
| `js-cookie` | Cookie handling for JWT |
| `react-icons` | Icon library |

### Development

| Package | Purpose |
|---------|---------|
| `tailwindcss` | CSS framework |
| `@tailwindcss/postcss` | PostCSS integration |
| `eslint` | Code linting |
| `eslint-config-next` | Next.js ESLint rules |
| `@types/*` | TypeScript type definitions |

---

## Docker

Build and run with Docker:

```bash
# Build with custom API URL
docker build --build-arg NEXT_PUBLIC_API_URL=https://api.example.com -t opendrive-frontend .

# Run
docker run -p 3000:3000 opendrive-frontend
```

> **Important:** The `NEXT_PUBLIC_API_URL` is baked into the build. For different environments, you must rebuild the image.

---

## Cloud Deployment Notes

When deploying to cloud platforms (GCP, AWS, DigitalOcean):

1. **Deploy backend first** and note the public URL
2. **Rebuild frontend** with the backend URL as `NEXT_PUBLIC_API_URL`
3. Deploy the rebuilt frontend image

See the main [README](../README.md) for detailed cloud deployment guides.

---

## License

This project is licensed under the **AGPL-3.0** license. See the root [LICENSE](../LICENSE) file for details.
