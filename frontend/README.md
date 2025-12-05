# Storage Platform - Frontend

A Next.js web app for managing folders and files, with public sharing.

---

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app runs on `http://localhost:3000`.

---

## Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── layout.tsx          # Root layout with auth provider
│   │   ├── page.tsx            # Home (redirects based on auth)
│   │   ├── login/page.tsx      # Login form
│   │   ├── register/page.tsx   # Registration form
│   │   ├── dashboard/page.tsx  # Overview with stats
│   │   ├── folders/
│   │   │   ├── page.tsx        # All root folders
│   │   │   └── [id]/page.tsx   # Folder detail view
│   │   └── public/
│   │       └── [shareId]/page.tsx  # Public share view
│   │
│   ├── components/
│   │   ├── ui/                 # Reusable UI primitives
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   └── Modal.tsx
│   │   ├── layouts/
│   │   │   └── DashboardLayout.tsx
│   │   ├── providers/
│   │   │   └── AuthProvider.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   ├── FolderCard.tsx
│   │   ├── FileCard.tsx
│   │   └── Breadcrumb.tsx
│   │
│   ├── lib/
│   │   └── api.ts              # Axios client + API functions
│   │
│   ├── stores/
│   │   └── authStore.ts        # Zustand auth state
│   │
│   └── app/globals.css         # Design system
```

---

## Pages Overview

### `/login`
Simple email + password form. Redirects to dashboard on success.

### `/register`
Create account form with password confirmation.

### `/dashboard`
Shows folder count and recent folders. Entry point after login.

### `/folders`
Grid of all root-level folders. Create, rename, delete, share folders.

### `/folders/[id]`
View folder contents:
- Subfolders
- Files
- Breadcrumb navigation
- Upload files
- Create nested folders

### `/public/[shareId]`
Read-only view for shared folders/files. No login required.

---

## State Management

Using **Zustand** for auth state:

```typescript
// stores/authStore.ts
{
  user: { id, email, role } | null,
  token: string | null,
  isLoading: boolean,
  isAuthenticated: boolean,
  
  login(email, password),
  register(email, password),
  logout(),
  checkAuth()
}
```

Token is stored in cookies (`js-cookie`) and sent with every API request.

---

## API Client

Located in `lib/api.ts`:

```typescript
// Axios instance with token interceptor
const api = axios.create({ baseURL: 'http://localhost:5000' });

// Exported API functions
authAPI.login(email, password)
authAPI.register(email, password)
authAPI.getMe()

foldersAPI.getAll()
foldersAPI.getById(id)
foldersAPI.create(name, parentId?)
foldersAPI.rename(id, name)
foldersAPI.delete(id)
foldersAPI.share(id)
foldersAPI.unshare(id)

filesAPI.upload(folderId, file)
filesAPI.rename(id, name)
filesAPI.delete(id)
filesAPI.share(id)
filesAPI.unshare(id)

publicAPI.getShared(shareId)
```

---

## Components

### `FolderCard`
Displays folder with:
- Folder icon with "Shared" badge
- Name and date
- Three-dot menu (rename, share, delete)
- Delete confirmation modal

### `FileCard`
Similar to FolderCard but for files:
- File type icon (emoji based on mime type)
- Size and date
- Download, rename, share, delete actions

### `Modal`
Reusable modal with:
- Header with title and close button
- Body slot for content
- Closes on Escape key or overlay click

### `Breadcrumb`
Shows path like: `Root > Projects > Design`
Each segment is clickable to navigate.

---

## Styling Approach

Pure CSS in `globals.css` with:

- **4pt spacing grid** (`--space-1` through `--space-12`)
- **Single accent color** (`#2563eb` blue)
- **Small border radii** (3-6px)
- **System font stack** (no custom fonts)
- **Dark mode support** via `prefers-color-scheme`

No Tailwind utility classes in components—all styling via CSS classes.

---

## Auth Flow

1. App loads → `AuthProvider` calls `checkAuth()`
2. If token exists, verify with `/api/auth/me`
3. If valid, set user in store
4. If invalid or missing, redirect to `/login`
5. Protected routes check `isAuthenticated`

---

## Key Features

✅ Login/Register with JWT  
✅ Create nested folder structure  
✅ Upload files to folders  
✅ Rename folders and files  
✅ Delete with confirmation modal  
✅ Generate shareable public links  
✅ Revoke share links  
✅ Breadcrumb navigation  
✅ Responsive layout  

---

## What I'd Improve With More Time

- Drag-and-drop file upload
- Drag files between folders
- Search functionality
- File preview (images, PDFs)
- Keyboard shortcuts
- Toast notifications instead of alerts
- Loading skeletons
- Optimistic UI updates
- Write component tests

---

## Environment Variables

For production, set in `.env.local`:

```
NEXT_PUBLIC_API_URL=https://your-api-domain.com
```

If not set, defaults to `http://localhost:5000`.

---

## Dependencies

- `next` - React framework
- `react` - UI library
- `typescript` - Type safety
- `axios` - HTTP client
- `zustand` - State management
- `js-cookie` - Cookie handling
- `react-icons` - Icon library
- `tailwindcss` - Utility CSS (mostly for base reset)
