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
| **Styling** | Tailwind CSS 4 + Custom CSS Variables |
| **Icons** | React Icons (Feather Icons) |
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
| `/app/trash` | View deleted items (soft delete) | Yes |
| `/app/public/[shareId]` | View shared folder/file (public) | No |

---

## Features

### 🔐 Authentication
- JWT-based authentication via cookies
- Persistent login sessions (7-day expiry)
- Automatic redirect for unauthenticated users
- Protected route handling with middleware
- Secure password hashing (bcrypt)

### 📁 Folder Management
- Create, rename, and delete folders
- Nested folder navigation with breadcrumbs
- Share folders via public links
- View folder statistics (count, storage used)
- Soft delete with trash/restore capability
- Real-time folder search

### 📄 File Management
- Upload files to any folder (up to 100MB per file)
- Multi-file upload support
- Drag & drop file upload
- Upload progress tracking with visual feedback
- Download files
- Rename and delete files
- Share individual files with public links
- File preview support for images, videos, audio, and documents
- Soft delete with 30-day retention

### 🔍 Search
- Global search across files and folders
- Real-time search with debouncing
- Search results with file paths and metadata
- Quick navigation to search results

### 🗑️ Trash/Recycle Bin
- Soft delete for files and folders
- 30-day retention period
- Restore deleted items
- Permanently delete items
- Empty trash functionality

### 🔗 Public Sharing
- Generate shareable links for folders and files
- Navigate through shared folder hierarchy
- Download files from shared folders
- Revoke share access anytime
- Copy share link to clipboard

### 📤 Upload Features
- Drag and drop files anywhere
- Visual upload progress widget
- Per-file progress tracking
- Success/error status indicators
- Multiple concurrent uploads
- File size validation

### 🎨 User Interface
- Clean, modern design with consistent colors
- Fully responsive (mobile, tablet, desktop)
- Dark mode support with CSS variables
- Smooth animations and transitions
- Accessible components with ARIA labels
- Keyboard navigation support

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

**Features:**
- Automatic token persistence via cookies
- Auth state hydration on app load
- Automatic logout on token expiry
- Error handling with user feedback

---

## API Client

The API client (`src/lib/api.ts`) provides typed wrappers for all backend endpoints with automatic JWT handling.

### Available API Modules

```typescript
import { authAPI, foldersAPI, filesAPI, publicAPI, searchAPI } from '@/lib/api';

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
await filesAPI.upload(folderId, files, onProgress);
await filesAPI.rename(id, name);
await filesAPI.delete(id);
await filesAPI.share(id);
await filesAPI.unshare(id);
await filesAPI.download(id);

// Public Access
await publicAPI.getShared(shareId);
await publicAPI.getSubfolder(shareId, folderId);

// Search
await searchAPI.search(query, type?);
```

### Interceptors
- **Request:** Automatically attaches JWT token from cookies
- **Response:** Handles 401 errors by clearing auth and redirecting to login
- **Upload:** Tracks upload progress for file uploads

---

## Key Components

### Layout Components

| Component | Description |
|-----------|-------------|
| `DashboardLayout` | Main app layout with sidebar and header |
| `Sidebar` | Navigation sidebar with folder links and logout |
| `Header` | Top header with search and user info |
| `Breadcrumb` | Navigation breadcrumbs for folder paths |

### Feature Components

| Component | Location | Description |
|-----------|----------|-------------|
| `FolderCard` | `src/components/FolderCard.tsx` | Folder display with actions (rename, share, delete) |
| `FileCard` | `src/components/FileCard.tsx` | File display with download, rename, share, delete |
| `Search` | `src/components/Search.tsx` | Global search with dropdown results |
| `UploadProgress` | `src/components/UploadProgress.tsx` | Upload progress widget with per-file tracking |
| `DropZone` | `src/components/DropZone.tsx` | Drag & drop file upload overlay |
| `FilePreview` | `src/components/FilePreview.tsx` | Modal file preview for images/videos/audio |

### UI Components

| Component | Location | Description |
|-----------|----------|-------------|
| `Modal` | `src/components/ui/Modal.tsx` | Reusable modal dialog with backdrop |
| `Button` | `src/components/ui/Button.tsx` | Styled button with variants (primary, secondary, danger, ghost) |
| `Input` | `src/components/ui/Input.tsx` | Form input with label and error handling |

### Providers

| Provider | Description |
|----------|-------------|
| `AuthProvider` | Wraps app, initializes auth state on mount |

---

## Styling

The app uses a custom CSS design system with Tailwind CSS 4 integration.

### Design System

**Color Palette:**
- **Primary Accent:** Blue (`#3b82f6`) - Used for primary actions, links, and highlights
- **Success:** Green (`#10b981`) - File success states
- **Danger:** Red (`#ef4444`) - Delete actions and errors
- **Storage:** Purple (`#a855f7`) - Storage-related visualizations

**Design Principles:**
- Clean, minimal aesthetic with solid colors (no gradients)
- Consistent spacing using Tailwind utilities
- CSS variables for theming and dark mode
- Smooth transitions and hover effects
- Responsive design mobile-first approach

### CSS Variables (Dark Mode Support)

```css
:root {
  /* Colors */
  --accent: #3b82f6;
  --accent-hover: #2563eb;

  /* Backgrounds */
  --bg-primary: #0a0a0b;
  --bg-secondary: #18181b;
  --bg-tertiary: #27272a;

  /* Text */
  --text-primary: #fafafa;
  --text-secondary: #a1a1aa;
  --text-muted: #71717a;

  /* Borders */
  --border-default: #3f3f46;
  --border-subtle: #27272a;

  /* Status Colors */
  --success: #10b981;
  --danger: #ef4444;
}
```

### Tailwind Integration

Components use Tailwind utility classes with CSS variable references:

```tsx
<div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg p-4">
  <h2 className="text-[var(--text-primary)] font-semibold">
    Folder Name
  </h2>
</div>
```

---

## Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── layout.tsx          # Root layout with providers
│   │   ├── page.tsx            # Home page (redirect logic)
│   │   ├── globals.css         # Global styles & CSS variables
│   │   └── app/
│   │       ├── login/          # Login page
│   │       ├── register/       # Registration page
│   │       ├── dashboard/      # Dashboard with stats
│   │       ├── folders/        # Folder views
│   │       │   ├── page.tsx    # Root folders list
│   │       │   └── [id]/       # Folder detail view
│   │       ├── trash/          # Trash/recycle bin
│   │       └── public/
│   │           └── [shareId]/  # Public shared content
│   ├── components/
│   │   ├── ui/                 # Base UI components (Button, Input, Modal)
│   │   ├── layouts/            # Layout components (DashboardLayout)
│   │   ├── providers/          # Context providers (AuthProvider)
│   │   ├── FolderCard.tsx      # Folder card component
│   │   ├── FileCard.tsx        # File card component
│   │   ├── Search.tsx          # Global search component
│   │   ├── UploadProgress.tsx  # Upload progress widget
│   │   ├── DropZone.tsx        # Drag & drop upload zone
│   │   ├── FilePreview.tsx     # File preview modal
│   │   ├── Sidebar.tsx         # Navigation sidebar
│   │   ├── Header.tsx          # Page header
│   │   └── Breadcrumb.tsx      # Breadcrumb navigation
│   ├── stores/
│   │   └── authStore.ts        # Zustand auth store
│   └── lib/
│       ├── api.ts              # Axios API client
│       ├── config.ts           # Runtime configuration
│       └── utils.ts            # Utility functions (cn, formatBytes)
├── public/                     # Static assets
├── .env.example                # Environment template
├── Dockerfile                  # Docker build
├── next.config.ts              # Next.js configuration
├── tailwind.config.js          # Tailwind CSS configuration
├── postcss.config.js           # PostCSS configuration
├── tsconfig.json               # TypeScript configuration
└── package.json
```

---

## Scripts

```bash
npm run dev     # Start development server (localhost:3000)
npm run build   # Build for production
npm start       # Start production server
npm run lint    # Run ESLint
```

---

## Dependencies

### Production

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | ^16.1.1 | React framework with App Router |
| `react` | ^19.0.0 | UI library |
| `react-dom` | ^19.0.0 | React DOM renderer |
| `typescript` | ^5 | Type safety |
| `zustand` | ^5.0.3 | State management |
| `axios` | ^1.7.9 | HTTP client |
| `js-cookie` | ^3.0.5 | Cookie handling for JWT |
| `react-icons` | ^5.4.0 | Icon library |
| `clsx` | ^2.1.1 | Class name utilities |
| `tailwind-merge` | ^2.6.0 | Tailwind class merging |

### Development

| Package | Purpose |
|---------|---------|
| `tailwindcss` | CSS framework (v4) |
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

## Development Tips

### Adding New Components

1. Create component in `src/components/`
2. Use `cn()` utility for conditional classes
3. Reference CSS variables for colors: `var(--accent)`, `var(--bg-secondary)`
4. Add TypeScript interfaces for props
5. Use Tailwind utilities with arbitrary values: `text-[var(--text-primary)]`

### State Management

- Use Zustand for global state (auth, settings)
- Use React hooks for local component state
- Keep stores minimal and focused

### API Integration

- Add new endpoints to `src/lib/api.ts`
- Use TypeScript interfaces for request/response types
- Handle errors with try-catch and user feedback

---

## Cloud Deployment Notes

When deploying to cloud platforms (Vercel, Netlify, AWS, GCP):

1. **Deploy backend first** and note the public URL
2. Set `NEXT_PUBLIC_API_URL` environment variable to backend URL
3. Deploy frontend (Vercel auto-deploys from GitHub)
4. Ensure CORS is configured on backend to allow frontend origin

### Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

See the main [README](../README.md) for detailed cloud deployment guides.

---

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

---

## License

This project is licensed under the **AGPL-3.0** license. See the root [LICENSE](../LICENSE) file for details.
