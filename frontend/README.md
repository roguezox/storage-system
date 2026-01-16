# OpenDrive Frontend

A modern, responsive Next.js application providing the user interface for the OpenDrive self-hosted cloud storage platform.

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
| `/app/folders/[id]` | View folder contents | Yes |
| `/app/trash` | View deleted items | Yes |
| `/app/public/[shareId]` | View shared content | No |

---

## Features

### Authentication
- JWT-based authentication via cookies
- Persistent login sessions (7-day expiry)
- Automatic redirect for unauthenticated users
- Protected route handling with middleware

### Folder Management
- Create, rename, and delete folders
- Nested folder navigation with breadcrumbs
- Share folders via public links
- Soft delete with trash/restore capability

### File Management
- Upload files (up to 100MB)
- Multi-file and drag-drop upload
- Upload progress tracking
- Download, rename, and delete files
- Share individual files with public links
- File preview for images, videos, and audio

### Search
- Global search across files and folders
- Real-time search with debouncing
- Quick navigation to search results

### Trash/Recycle Bin
- Soft delete for files and folders
- 30-day retention period
- Restore or permanently delete items
- Empty trash functionality

### Public Sharing
- Generate shareable links
- Navigate shared folder hierarchy
- Download files from shared folders
- Revoke access anytime

---

## State Management

The app uses **Zustand** for lightweight state management.

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

The API client (`src/lib/api.ts`) provides typed wrappers for all backend endpoints.

### Available API Modules

```typescript
import { authAPI, foldersAPI, filesAPI, publicAPI, searchAPI } from '@/lib/api';

// Authentication
await authAPI.login(email, password);
await authAPI.register(email, password);

// Folders
await foldersAPI.getAll();
await foldersAPI.getById(id);
await foldersAPI.create(name, parentId?);

// Files
await filesAPI.upload(folderId, files, onProgress);
await filesAPI.download(id);

// Search
await searchAPI.search(query, type?);
```

---

## Styling

The app uses a custom CSS design system with Tailwind CSS 4.

### CSS Variables

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

  /* Status */
  --success: #10b981;
  --danger: #ef4444;
}
```

---

## Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Home page
│   │   ├── globals.css         # Global styles
│   │   └── app/
│   │       ├── login/          # Login page
│   │       ├── register/       # Registration page
│   │       ├── dashboard/      # Dashboard
│   │       ├── folders/        # Folder views
│   │       ├── trash/          # Trash view
│   │       └── public/         # Public shared content
│   ├── components/
│   │   ├── ui/                 # Base UI components
│   │   ├── layouts/            # Layout components
│   │   ├── FolderCard.tsx
│   │   ├── FileCard.tsx
│   │   ├── Search.tsx
│   │   └── UploadProgress.tsx
│   ├── stores/
│   │   └── authStore.ts        # Zustand auth store
│   └── lib/
│       ├── api.ts              # Axios API client
│       └── utils.ts            # Utilities
├── public/                     # Static assets
├── Dockerfile
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

## Docker

```bash
# Build with custom API URL
docker build --build-arg NEXT_PUBLIC_API_URL=https://api.example.com -t opendrive-frontend .

# Run
docker run -p 3000:3000 opendrive-frontend
```

> **Important:** The `NEXT_PUBLIC_API_URL` is baked into the build. For different environments, rebuild the image.

---

## Dependencies

### Production

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | ^16.1.1 | React framework |
| `react` | ^19.0.0 | UI library |
| `typescript` | ^5 | Type safety |
| `zustand` | ^5.0.3 | State management |
| `axios` | ^1.7.9 | HTTP client |
| `js-cookie` | ^3.0.5 | Cookie handling |
| `react-icons` | ^5.4.0 | Icons |
| `tailwindcss` | v4 | CSS framework |

---

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

---

## License

AGPL-3.0. See [LICENSE](../LICENSE) for details.
