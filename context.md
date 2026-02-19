# Moodboard Generator — Project Context

A Farcaster mini-app for creating, composing, and sharing moodboard collages. Users upload images, arrange them on an interactive canvas, and export or cast the result to Farcaster. Built mobile-first with an ultra-minimalist interface where the artwork is always the focal point.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Application Flow](#application-flow)
- [Feature Reference](#feature-reference)
- [Data Model](#data-model)
- [Storage Architecture](#storage-architecture)
- [Cloud Infrastructure](#cloud-infrastructure)
- [API Routes](#api-routes)
- [Authentication & Security](#authentication--security)
- [Canvas Rendering Pipeline](#canvas-rendering-pipeline)
- [Design System & Style Guide](#design-system--style-guide)
- [Mobile & Touch Optimization](#mobile--touch-optimization)
- [Conventions & Patterns](#conventions--patterns)
- [Configuration & Environment](#configuration--environment)
- [Deployment](#deployment)
- [Current Status](#current-status)

---

## Tech Stack

| Layer          | Technology                          | Version |
| -------------- | ----------------------------------- | ------- |
| Framework      | Next.js (App Router, Turbopack)     | 16.1.6  |
| UI Library     | React                               | 19.2.3  |
| Language       | TypeScript (strict mode)            | ^5      |
| Styling        | Tailwind CSS v4 (via PostCSS)       | ^4      |
| Font           | Geist Sans (Google Fonts, variable) | —       |
| Compiler       | React Compiler (babel plugin)       | 1.0.0   |
| Local Storage  | IndexedDB (client-side)             | —       |
| Cloud Database | Turso (libSQL / SQLite)             | —       |
| ORM            | Drizzle ORM                         | ^0.45   |
| Image Storage  | Pinata IPFS                         | —       |
| Auth           | Farcaster Quick Auth (JWT)          | ^0.0.8  |
| Farcaster SDK  | @farcaster/miniapp-sdk              | ^0.2.3  |
| Canvas         | HTML5 Canvas API                    | —       |
| Hosting        | Vercel (serverless functions)        | —       |

Minimal runtime dependencies. No component library, no state management library, no image processing library — canvas rendering, compression, and color extraction are hand-rolled.

---

## Project Structure

```
moodboard-generator/
├── public/
│   ├── .well-known/
│   │   └── farcaster.json          # Farcaster mini-app manifest
│   ├── icon.png                    # App icon / splash image
│   ├── og.png                      # Open Graph image
│   └── hero.png                    # Hero image
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── cast-image/
│   │   │   │   └── route.ts        # Upload moodboard image to IPFS for casting
│   │   │   ├── images/
│   │   │   │   └── upload/
│   │   │   │       └── route.ts    # Upload library images to IPFS
│   │   │   ├── sync/
│   │   │   │   └── route.ts        # Push/pull moodboards to/from cloud
│   │   │   └── user/
│   │   │       └── route.ts        # User registration/update
│   │   ├── globals.css             # Global styles, CSS variables, utilities
│   │   ├── layout.tsx              # Root layout, viewport meta, Farcaster metadata, CloudProvider
│   │   └── page.tsx                # Renders <MoodboardGenerator />
│   ├── components/
│   │   ├── MoodboardGenerator.tsx  # Main app component (views, state, all features)
│   │   ├── InteractiveCanvas.tsx   # Drag/resize/pin canvas for manual mode
│   │   ├── ImageLibrary.tsx        # Image library view (search, tags, multi-select)
│   │   └── CloudProvider.tsx       # Cloud auth context, sync orchestration
│   └── lib/
│       ├── auth.ts                 # Server-side JWT verification, rate limiting, origin validation
│       ├── canvas.ts               # Image loading, rendering, compression, thumbnails, color extraction
│       ├── cloud.ts                # Cloud sync logic (push/pull, image upload, parallel operations)
│       ├── db.ts                   # Turso database client (Drizzle + libSQL)
│       ├── schema.ts              # Drizzle ORM schema (users, moodboards, images tables)
│       ├── storage.ts              # IndexedDB wrapper, TypeScript interfaces, image hashing
│       └── templates.ts            # Built-in templates, apply/create/preview utilities
├── drizzle.config.ts               # Drizzle Kit config for Turso
├── next.config.ts                  # React Compiler enabled
├── tsconfig.json                   # Strict, path alias @/* → ./src/*
├── postcss.config.mjs              # @tailwindcss/postcss plugin
├── .env                            # Template env file (no secrets)
├── .env.local                      # Real secrets (gitignored)
└── package.json
```

### File Responsibilities

**`src/lib/storage.ts`** — Local data layer. Defines all TypeScript interfaces (`CanvasImage`, `LightCanvasImage`, `Artwork`, `Template`, `Draft`, `LibraryImage`, `Orientation`, `TemplateSlot`). Wraps IndexedDB (v3) with generic helpers. Exposes CRUD for `artworks`, `templates`, `draft`, and `library` object stores. Provides `imageHash()` for content-based deduplication (FNV-1a), `ensureInLibrary()` for automatic library ingestion, and `stripDataUrls()`/`rehydrateImages()` for lightweight undo snapshots.

**`src/lib/canvas.ts`** — Image processing and rendering. Contains the auto-generate collage algorithm (`generatePlacements`), the manual-mode renderer (`renderManualMoodboard`), the cast blob renderer (`renderMoodboardToBlob`), collection thumbnail generator (`renderThumbnail`), image compression for storage (`compressForStorage`) and upload (`compressForUpload`), initial scatter layout (`createInitialPlacements`), and the dominant color extraction pipeline (`extractColors`).

**`src/lib/templates.ts`** — Template system. Defines canvas dimensions per orientation (`CANVAS_DIMS`), the 5 built-in templates, functions to apply templates, convert artwork layouts to reusable templates, rescale images across orientation changes, and generate SVG preview thumbnails.

**`src/lib/cloud.ts`** — Cloud sync logic. Handles `pushToCloud` (with incremental sync support via `since` timestamp), `pullFromCloud` (parallel IPFS image fetching), `registerUser`, and image upload with client-side compression. Uses a concurrent task runner (`runConcurrent`) with configurable parallelism (default 3) for both uploads and downloads.

**`src/lib/auth.ts`** — Server-side security. JWT verification via `@farcaster/quick-auth`, origin validation against allowed domains, and IP-based rate limiting (sliding window, 60s buckets).

**`src/lib/schema.ts`** — Drizzle ORM schema for Turso. Defines `users`, `moodboards`, and `images` tables with indexes for efficient queries by `fid` and `updatedAt`.

**`src/lib/db.ts`** — Turso database client. Creates a `drizzle` instance from `@libsql/client` using env vars for URL and auth token.

**`src/components/InteractiveCanvas.tsx`** — The interactive canvas. Handles drag (Pointer Events), selection, resize (+/- buttons), pin/unpin toggle, delete, and z-index layering. Floating toolbar auto-flips below the image when near the top edge of the canvas. Accepts `bgColor`, `imageMargin`, and `onCommit` props.

**`src/components/ImageLibrary.tsx`** — Full-screen image library view. Grid layout with search, tag filtering, sort (newest/oldest/name), multi-select, tag editing, and "Add to Canvas" action. Images are deduplicated by content hash.

**`src/components/CloudProvider.tsx`** — React context for cloud state. Manages Farcaster user detection (via `sdk.context`), authenticated API calls (`authFetch` using Quick Auth), sync orchestration with lock mechanism, and auto-sync on login. Provides `user`, `syncStatus`, `signIn`, `signOut`, and `sync` to children.

**`src/components/MoodboardGenerator.tsx`** — The main application. Manages four views (`create`, `auto-result`, `manual`, `library`), all application state, lightweight undo/redo stacks with image store ref, toolbar panels, categories, auto-save drafts, the visual collection grid with thumbnails, delete confirmation, and all export actions.

---

## Application Flow

```
┌─────────────────────────────────────────────────────┐
│                    CREATE VIEW                       │
│                                                      │
│   [Library] [Sign in / Sync]                        │
│   Title input → Caption input → Upload images        │
│                                                      │
│   [Generate]              [Arrange]                  │
│                                                      │
│   Draft recovery banner (if unsaved work exists)     │
│                                                      │
│   ─── Collection Grid ───                            │
│   Search | Category filters | Sort                   │
│   ┌─────┐ ┌─────┐ ┌─────┐                          │
│   │thumb│ │thumb│ │thumb│  (visual thumbnails)      │
│   │title│ │title│ │title│                            │
│   └─────┘ └─────┘ └─────┘                          │
└──────┬────────────────────────┬──────────────────────┘
       │                        │
  ┌────▼──────┐           ┌─────▼─────────────────────┐
  │ AUTO-     │           │ MANUAL VIEW                │
  │ RESULT    │           │                            │
  │           │           │ [←] [Undo][Redo]     [Save]│
  │ ← Back   │           │ [A4P][A4L][□] BG Margin    │
  │ Refresh   │           │ Tags Templates Library [+] │
  │           │           │ ┌──────────────────────┐   │
  │ [image]   │           │ │  Interactive Canvas   │   │
  │           │           │ │  [floating toolbar]   │   │
  │ Save      │           │ └──────────────────────┘   │
  │ Print     │           │ Save / Print / Cast        │
  │ Cast      │           │ (auto-save every 30s)      │
  └───────────┘           └────────────────────────────┘
                                     │
                          ┌──────────▼───────────────┐
                          │ LIBRARY VIEW             │
                          │ Search | Tag filter | Sort│
                          │ ┌───┐ ┌───┐ ┌───┐ ┌───┐ │
                          │ │img│ │img│ │img│ │img│ │
                          │ └───┘ └───┘ └───┘ └───┘ │
                          │ Multi-select → Add to    │
                          │ Canvas                   │
                          └──────────────────────────┘
```

**Create → Auto-Result**: Files are loaded, passed through the auto-placement algorithm, and rendered to a single PNG data URL.

**Create → Manual**: Files are compressed to JPEG data URLs, scattered on the canvas, and the manual view opens. Images are also added to the library in the background.

**Collection → Manual**: Tapping a saved artwork restores all stored state (images, orientation, background, margin, categories).

**Manual → Library**: Opens the library to browse/search all uploaded images. Selected images can be added directly to the current canvas.

---

## Feature Reference

### Image Upload & Validation

- Minimum 4, maximum 20 images
- Accepted formats: JPEG, PNG, WebP, GIF
- Hidden `<input type="file" multiple>` triggered by tap-to-upload area
- Horizontal scrollable thumbnail strip with individual remove buttons
- Counter display: `5/20`
- Title is required; caption is optional

### Auto-Generate Mode

Renders a collage using `renderMoodboard()` with an organic scatter algorithm. Grid-based placement with random size multipliers, offsets, white borders, and subtle shadows. Title/caption rendered at bottom-left. Regenerate button shuffles the layout.

### Interactive Manual Mode

Full interactive composition surface with:
- **Drag**: Pointer Events with window-level listeners for smooth off-element dragging
- **Selection**: Blue ring indicator, auto-bring-to-front
- **Resize**: +/- buttons (0.85× / 1.18×), aspect-ratio locked, clamped 30px–95% of canvas width
- **Pin/Unpin**: Locks position and size. Pin icon on pinned images
- **Delete**: Removes selected image from canvas
- **Layering**: Z-index based, selection auto-promotes
- **Floating toolbar**: Appears above selected image; auto-flips below when image is near the top edge (< 10% from top)
- **Add images**: "+" button in toolbar opens file picker to add images directly to canvas without leaving the editor

### Canvas Format

| Format          | Dimensions   | Aspect Ratio | Icon        |
| --------------- | ------------ | ------------ | ----------- |
| Tall rectangle  | 1080 × 1527 | 1 : √2 (A4)  | Vertical bar |
| Long rectangle  | 1527 × 1080 | √2 : 1 (A4)  | Horizontal bar |
| Square          | 1080 × 1080 | 1 : 1        | Square      |

Switching format proportionally rescales all positions and sizes.

### Undo / Redo History

**Memory-optimized**: Stores up to 50 lightweight snapshots (`LightCanvasImage[]` — metadata only, no image data URLs). Image blobs are held in a separate `Map<string, string>` ref (`imageStoreRef`). On undo/redo, metadata snapshots are rehydrated with blob data from the store. This reduces memory from ~200MB to ~1MB for 20 images × 50 history levels.

Keyboard shortcuts: `Cmd+Z` / `Ctrl+Z` for undo, `Cmd+Shift+Z` / `Ctrl+Y` for redo. Only active in manual view.

### Auto-Save Drafts

Every 30 seconds in manual mode, the current state is saved to IndexedDB (`draft` store, single entry with id `'current'`). On app load, if a draft exists, a recovery banner appears: "Unsaved work found — Recover / Dismiss". Draft is cleared on intentional save, export, or cast.

### Moodboard Categorization

10 default categories: Inspiration, Project, Client, Personal, Color Study, Texture & Material, Typography, Brand Identity, Travel, Seasonal. Users can create custom categories. Multiple categories per moodboard. Categories are persisted with artwork and used for collection filtering.

### Image Library

Separate full-screen view accessible from create view and manual toolbar. Features:
- Grid layout (3 columns mobile, 4 on wider screens)
- Search by filename or tags
- Tag filtering with chip-based selector
- Sort: newest, oldest, name
- Multi-select with visual checkmarks
- Per-image tag editing (add/remove)
- "Add to Canvas" action for selected images
- Images auto-added to library when creating moodboards
- Content-based deduplication via FNV-1a hash (`imageHash`)

### Collection View

Visual thumbnail grid (2 columns mobile, 3 wider) replacing the previous text list. Each card shows:
- JPEG thumbnail preview (generated on save, ~200px wide)
- Title, date, category chips
- Pin indicator for favorites
- Hover actions: pin/unpin, duplicate, delete

Features: search bar, category filter chips, sort (newest/oldest/title/image count). Pinned moodboards always appear first.

### Delete Confirmation

Deleting an artwork shows a modal confirmation dialog ("Delete this moodboard? This action cannot be undone.") with Cancel and Delete buttons, instead of deleting immediately.

### Background Color Picker

Expandable panel with 5 preset swatches (white, off-white, light gray, warm off-white, black) plus extracted color suggestions. Active color shows a scaled-up ring indicator. Dark backgrounds auto-switch title/caption text to light colors.

### Color Extraction

Samples up to 8 canvas images at 6×6 pixels, quantizes to dominant color buckets, converts to muted background-appropriate tones (15% saturation, 92–97% lightness). Returns up to 3 colors.

### Image Margin Control

Toggle adds a clean white border around each image. Display uses CSS `box-shadow`. Export renders `fillRect` borders at `max(2, canvasWidth * 0.003)` pixels.

### Templates

5 built-in templates (Blank, Centered, Diagonal, Scattered, Corners) plus user-created templates. Bottom-sheet UI with SVG previews. Templates use relative coordinates for device-independent layouts.

### Export: Download, Print, Cast

**Save/Download**: Uses Web Share API (`navigator.share`) for "Save to Camera Roll" on mobile. Falls back to anchor download (`<a download>`) on desktop. Filename derived from title.

**Print**: Opens a new window with print-optimized HTML, auto-triggers `window.print()`.

**Cast to Farcaster**:
1. Renders moodboard to compressed JPEG blob (max 1200px, 85% quality) via `renderMoodboardToBlob`
2. Uploads blob to Pinata IPFS via `/api/cast-image` (FormData)
3. Opens Farcaster compose with text + IPFS image URL embed via `sdk.actions.composeCast`
4. Falls back to Warpcast deep link if SDK action fails
5. Shows step-by-step status feedback ("Rendering image…", "Uploading image…", "Opening cast composer…")

### Farcaster Integration

- **Mini App SDK**: `sdk.actions.ready()` on load, `sdk.actions.composeCast()` for casting
- **Mini App Metadata**: `fc:miniapp` meta tag in layout with launch action config
- **Manifest**: `public/.well-known/farcaster.json` with account association
- **User Context**: `sdk.context` for user FID, username, profile picture
- **Quick Auth**: `sdk.quickAuth.fetch()` and `sdk.quickAuth.getToken()` for authenticated API calls
- **Preconnect**: `<link rel="preconnect" href="https://auth.farcaster.xyz" />` for faster auth

### Cloud Sync

- **Sign in**: Automatic via Farcaster context in mini-app, or manual "Sign in" button
- **Sync flow**: Push local artworks → Pull cloud artworks → Merge into IndexedDB
- **Incremental sync**: Only pushes artworks modified since `lastSyncAt` timestamp
- **Parallel operations**: Image uploads and downloads use a concurrent task runner (max 3 workers)
- **Image deduplication**: Content hash prevents re-uploading identical images
- **Status indicators**: "Syncing…", "Synced", "Retry" with cloud icon variants
- **Auto-sync**: Triggers automatically when user is detected on app load

---

## Data Model

### CanvasImage

```typescript
interface CanvasImage {
  id: string;           // Unique ID (e.g., "img-1708000000000-abc123")
  dataUrl: string;      // JPEG data URL (compressed to max 1000px, 80% quality)
  x: number;            // Logical x position on canvas
  y: number;            // Logical y position on canvas
  width: number;        // Logical width
  height: number;       // Logical height
  rotation: number;     // Degrees (always 0 in manual mode)
  pinned: boolean;      // Lock state
  zIndex: number;       // Layer order
  naturalWidth: number; // Original (compressed) width
  naturalHeight: number;// Original (compressed) height
}

type LightCanvasImage = Omit<CanvasImage, 'dataUrl'>; // For undo/redo stack
```

### Artwork

```typescript
interface Artwork {
  id: string;
  title: string;
  caption: string;
  images: CanvasImage[];
  canvasWidth: number;
  canvasHeight: number;
  format: 'tall' | 'long' | 'square';
  bgColor: string;
  imageMargin: boolean;
  categories: string[];
  pinned: boolean;
  createdAt: string;   // ISO 8601
  updatedAt: string;   // ISO 8601
  thumbnail?: string;  // Small JPEG data URL for collection preview
}
```

### Draft

```typescript
interface Draft {
  id: 'current';       // Always single entry
  title: string;
  caption: string;
  images: CanvasImage[];
  orientation: Orientation;
  bgColor: string;
  imageMargin: boolean;
  categories: string[];
  savedAt: string;
}
```

### LibraryImage

```typescript
interface LibraryImage {
  id: string;           // Content hash (FNV-1a)
  dataUrl: string;
  filename: string;
  naturalWidth: number;
  naturalHeight: number;
  tags: string[];
  uploadedAt: string;
}
```

### Template

```typescript
interface TemplateSlot {
  cx: number;    // Center x as fraction (0–1)
  cy: number;    // Center y as fraction (0–1)
  scale: number; // Width as fraction of canvas width
  rotation: number;
  zIndex: number;
}

interface Template {
  id: string;
  name: string;
  slots: TemplateSlot[];
  isBuiltIn: boolean;
}
```

---

## Storage Architecture

### Client-Side (IndexedDB)

Database name: `moodboard-artworks`, version 3.

| Object Store | Key Path | Content                                          |
| ------------ | -------- | ------------------------------------------------ |
| `artworks`   | `id`     | Full `Artwork` objects including image data URLs  |
| `templates`  | `id`     | User-created `Template` objects                   |
| `draft`      | `id`     | Single auto-save draft entry (id: `'current'`)   |
| `library`    | `id`     | `LibraryImage` objects (deduplicated by hash)     |

A shared `openDB()` helper handles version upgrades. Generic `idbPut`, `idbGetAll`, `idbGet`, `idbDelete` helpers avoid code duplication.

### Cloud (Turso + Pinata IPFS)

| Service | Purpose | Free Tier |
| ------- | ------- | --------- |
| Turso   | Metadata (users, moodboard state, image refs) | 9GB, 1B reads/mo |
| Pinata  | Image binary storage (IPFS) | 1GB |
| Vercel  | Hosting + serverless functions | 100GB bandwidth |

Cloud storage separates image binaries (IPFS) from moodboard metadata (Turso). Canvas state stores `imageHash` references instead of raw data URLs. On pull, images are fetched from IPFS and converted back to data URLs.

---

## Cloud Infrastructure

### Database Schema (Turso via Drizzle ORM)

```typescript
// users table
users: { fid (PK), username, pfpUrl, createdAt }

// moodboards table (indexes: fid, fid+updatedAt)
moodboards: {
  id (PK), fid (FK→users), title, caption,
  categories (JSON string[]), canvasState (JSON CloudCanvasImage[]),
  canvasWidth, canvasHeight, background, orientation,
  margin (boolean), pinned (boolean),
  createdAt, updatedAt, syncVersion
}

// images table (index: fid)
images: {
  hash (PK), fid (FK→users), url (IPFS gateway URL),
  filename, naturalWidth, naturalHeight,
  tags (JSON string[]), createdAt
}
```

### Sync Flow

```
Client                          Server (Vercel)              Cloud
  │                                │                          │
  │── pushToCloud(artworks) ──────►│                          │
  │   (only artworks modified      │                          │
  │    since lastSyncAt)           │                          │
  │                                │── upload images ────────►│ Pinata IPFS
  │                                │   (parallel, max 3)      │
  │                                │── upsert moodboards ───►│ Turso
  │                                │                          │
  │── pullFromCloud() ───────────►│                          │
  │                                │◄── fetch moodboards ────│ Turso
  │                                │◄── fetch image URLs ────│ Turso
  │◄── boards + imageMap ─────────│                          │
  │                                │                          │
  │── fetch IPFS images ──────────────────────────────────────►│ IPFS Gateway
  │   (parallel, max 3)           │                          │
  │                                │                          │
  │── save to IndexedDB           │                          │
```

### Image Compression Pipeline

All images are compressed client-side before upload:
- **For storage** (`compressForStorage`): Max 1000px, JPEG 80%
- **For IPFS upload** (`compressForUpload`): Max 2048px, JPEG 82%
- **For cast image** (`renderMoodboardToBlob`): Max 1200px, JPEG 85%
- **For thumbnails** (`renderThumbnail`): Max 200px, JPEG 60%

---

## API Routes

All API routes are Next.js App Router serverless functions on Vercel.

### `POST /api/cast-image`

Uploads a moodboard image to IPFS for Farcaster cast embedding. Public endpoint (no auth required) with rate limiting (10 req/min per IP) and origin validation.

- Input: FormData with `file` blob
- Validates: file size (max 10MB), type (JPEG/PNG/WebP)
- Materializes blob as ArrayBuffer before Pinata forwarding (Node.js compatibility)
- Returns: `{ url, ipfsHash }`

### `POST /api/images/upload`

Uploads individual images to IPFS for cloud sync. Authenticated (Quick Auth JWT).

- Input: FormData with `file`, `hash`, dimensions, tags
- Validates: file size (max 15MB), required fields
- Deduplicates: checks existing `hash` in Turso before uploading
- Returns: `{ url, hash }`

### `POST /api/sync`

Pushes moodboard data to cloud. Authenticated. Validates ownership (`fid` from JWT matches board `fid`). Sanitizes inputs (title length, category count). Max 100 boards per request.

### `GET /api/sync`

Pulls all moodboards and associated image metadata for the authenticated user. Returns `{ boards, imageMap }`.

### `POST /api/user`

Registers or updates a Farcaster user. Authenticated. Upserts by `fid`.

---

## Authentication & Security

### Farcaster Quick Auth

Server-side JWT verification using `@farcaster/quick-auth`:

```
Client (Warpcast webview)
  │── sdk.quickAuth.fetch(url, init)   // Auto-attaches JWT
  │   OR
  │── sdk.quickAuth.getToken()         // Manual token for custom headers
  │
Server (API route)
  │── verifyAuth(req)
  │   ├── Extract Bearer token from Authorization header
  │   └── quickAuth.verifyJwt({ token, domain: APP_DOMAIN })
  │       └── Returns { fid: number } or null
```

### Origin Validation

All API routes call `checkOrigin(req)` which validates the `Origin` header against an allowlist:
- Production: `https://moodboard-generator-phi.vercel.app`
- Development: `http://localhost:3000`, `:3001`, `:3002`

Requests with non-matching origins receive 403 Forbidden.

### Rate Limiting

The `/api/cast-image` endpoint (public, no auth) has IP-based rate limiting:
- Sliding window: 60 seconds
- Max requests: 10 per window per IP
- In-memory `Map<string, { count, resetAt }>`
- Auto-cleanup when map exceeds 10,000 entries
- Returns 429 with `Retry-After: 60` header when exceeded

### Environment Variables

Secrets are stored in `.env.local` (gitignored). The `.env` file contains only placeholder templates.

| Variable | Purpose |
| -------- | ------- |
| `TURSO_DATABASE_URL` | Turso database connection URL |
| `TURSO_AUTH_TOKEN` | Turso auth token |
| `PINATA_JWT` | Pinata API key for IPFS uploads |
| `PINATA_GATEWAY` | Pinata dedicated gateway domain |
| `APP_DOMAIN` | Domain for Quick Auth JWT verification |

All variables must also be set in Vercel dashboard for production deployment.

---

## Canvas Rendering Pipeline

### Auto-Generate Mode

```
File[] → loadImage() → HTMLImageElement[] → generatePlacements()
  → render to off-screen canvas (white border + shadow per image)
  → drawTitleCaption()
  → canvas.toDataURL('image/png')
```

### Manual Mode (Export)

```
CanvasImage[] → loadImageFromUrl() per dataUrl → HTMLImageElement[]
  → sort by zIndex → fill canvas with bgColor
  → for each: translate, rotate, optional margin fillRect, drawImage
  → drawTitleCaption() (auto-detects dark bg)
  → canvas.toDataURL('image/png')
```

### Cast Blob Rendering

```
CanvasImage[] → scale to max 1200px wide → render all images
  → canvas.toBlob('image/jpeg', 0.85) → Blob
  → FormData upload to /api/cast-image → IPFS URL
```

### Thumbnail Generation

```
CanvasImage[] → scale to ~200px wide → render all images (no title/caption)
  → canvas.toDataURL('image/jpeg', 0.6) → small data URL stored with artwork
```

---

## Design System & Style Guide

### Philosophy

Ultra-minimalist. The interface should be "almost invisible" — the user's images and composition are the complete focus. Every UI element exists only because it's necessary.

### Colors (Light Mode)

| Usage             | Color        | Tailwind Class       |
| ----------------- | ------------ | -------------------- |
| Background        | `#FFFFFF`    | `bg-white`           |
| Primary text      | `#404040`    | `text-neutral-700`   |
| Secondary text    | `#737373`    | `text-neutral-500`   |
| Muted text        | `#a3a3a3`    | `text-neutral-400`   |
| Borders           | `#d4d4d4`    | `border-neutral-300` |
| Light borders     | `#e5e5e5`    | `border-neutral-200` |
| Canvas default BG | `#f5f5f4`    | —                    |
| Selection ring    | Blue 400/50% | `ring-blue-400/50`   |
| Danger hover      | Red 500      | `hover:text-red-500` |
| Success feedback  | Green 600    | `text-green-600`     |

### Colors (Dark Mode)

Dark mode uses a dark grey palette (not pure black) for reduced eye strain and better contrast.

| Usage             | Color        | Tailwind Class              |
| ----------------- | ------------ | --------------------------- |
| Background        | `#1a1a1a`    | `dark:bg-neutral-900`       |
| Surface/Card      | `#262626`    | `dark:bg-neutral-800`       |
| Elevated surface  | `#333333`    | `dark:bg-neutral-700`       |
| Primary text      | `#f5f5f5`    | `dark:text-neutral-100`     |
| Secondary text    | `#a3a3a3`    | `dark:text-neutral-400`     |
| Muted text        | `#737373`    | `dark:text-neutral-500`     |
| Borders           | `#404040`    | `dark:border-neutral-700`   |
| Light borders     | `#333333`    | `dark:border-neutral-800`   |
| Canvas default BG | `#262626`    | —                           |
| Selection ring    | Blue 400/50% | `dark:ring-blue-400/50`     |
| Danger hover      | Red 400      | `dark:hover:text-red-400`   |
| Success feedback  | Green 400    | `dark:text-green-400`       |

### Dark Mode Implementation

**Toggle**: Manual sun/moon toggle button in the top-right corner of the header. Uses `darkMode: 'class'` in Tailwind config so the user controls the theme (not system preference).

**State persistence**: Theme preference stored in `localStorage` under key `'theme'` (`'light'` | `'dark'`). On load, check localStorage first; if not set, default to light mode.

**Configuration**: Set `darkMode: 'class'` in Tailwind config. The `dark` class is added/removed from `<html>` element.

**Theme Toggle Component** (in header, top-right):

```tsx
const [isDark, setIsDark] = useState(false);

useEffect(() => {
  const stored = localStorage.getItem('theme');
  const dark = stored === 'dark';
  setIsDark(dark);
  document.documentElement.classList.toggle('dark', dark);
}, []);

const toggleTheme = () => {
  const next = !isDark;
  setIsDark(next);
  localStorage.setItem('theme', next ? 'dark' : 'light');
  document.documentElement.classList.toggle('dark', next);
};

// Toggle button (top-right of header)
<button
  onClick={toggleTheme}
  className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
  aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
>
  {isDark ? (
    // Sun icon (show in dark mode → click to go light)
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  ) : (
    // Moon icon (show in light mode → click to go dark)
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )}
</button>
```

**CSS Variables** (in `globals.css`):

```css
:root {
  --background: #ffffff;
  --foreground: #404040;
  --surface: #f5f5f5;
  --border: #d4d4d4;
}

.dark {
  --background: #1a1a1a;
  --foreground: #f5f5f5;
  --surface: #262626;
  --border: #404040;
}
```

**Flash prevention**: Add inline script in `<head>` of `layout.tsx` to set `dark` class before paint:

```html
<script dangerouslySetInnerHTML={{ __html: `
  (function() {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark') document.documentElement.classList.add('dark');
  })();
`}} />
```

**Key considerations**:
- Canvas export should always use the selected canvas `bgColor`, regardless of app theme
- Image thumbnails and previews need sufficient contrast on dark surfaces
- Button outlines use `border-neutral-600` in dark mode for visibility
- Modal overlays use `bg-black/60` instead of `bg-black/40` in dark mode
- Toggle button uses 20px icons matching the action bar icon size
- Smooth transition on hover (`transition-colors`)

### Typography

- **Font**: Geist Sans (variable, `next/font/google`)
- **Weights**: 300 (light) for body, 400 for headings, 500 (medium) for thumbnail titles
- **Sizes**: `text-lg` title input, `text-sm` body, `text-xs` buttons, `text-[11px]` labels, `text-[10px]` chips
- **Labels**: 11px uppercase tracking-widest for section headers

### Interactive Elements

- **Buttons**: Thin outline (`border border-neutral-300`) or plain text. Pill-shaped for save. No fills or shadows.
- **Inputs**: Bottom-border only. Placeholder as label.
- **Collection grid**: Rounded cards with thumbnail, hover overlay actions.
- **Bottom sheet**: Semi-transparent overlay, white panel, rounded top, drag handle.
- **Confirmation dialog**: Centered modal with overlay, rounded corners, cancel/action buttons.
- **Toolbar buttons**: 32px height, 11px text, subtle bg on active state.

### Icons

All icons are inline SVGs with `stroke="currentColor"`, `strokeWidth="1.5"`, no fill. Sizes: 20px action bar, 18px undo/redo, 14px toolbar/collection, 12px pin indicator, 10-11px hover actions.

---

## Mobile & Touch Optimization

- **Viewport**: `maximumScale: 1`, `userScalable: false`
- **Touch targets**: All interactive elements ≥ 44×44px
- **Canvas interaction**: `touch-none` prevents browser scroll/zoom during drag
- **Pointer Events**: Unified handling across devices; window-level listeners for smooth dragging
- **100dvh**: `min-h-[100dvh]` accounts for mobile browser chrome
- **Overscroll**: `overscroll-behavior: none` prevents pull-to-refresh
- **Web Share API**: "Save" uses `navigator.share({ files })` on mobile for native camera roll save
- **Scrollbar hiding**: `.scrollbar-hide` utility for horizontal strips

---

## Conventions & Patterns

### State Management

All state lives in `MoodboardGenerator` via `useState`. The `InteractiveCanvas` and `ImageLibrary` are controlled components. Cloud state is managed via `CloudProvider` context (`useCloud` hook). No external state library.

### Undo/Redo Memory Optimization

Image data URLs are stored in a `useRef<Map<string, string>>` keyed by image ID. The undo/redo stacks hold `LightCanvasImage[][]` (no `dataUrl` field). `commitSnapshot()` strips data URLs via `stripDataUrls()`. `undo()`/`redo()` rehydrate snapshots via `rehydrateImages()` from the ref map.

### ID Generation

All entity IDs use: `prefix-timestamp-randomAlpha`, e.g., `img-1708000000000-x7k2m9`, `artwork-1708000000000-abc123`.

### Coordinate System

Logical coordinates (e.g., 1080×1527 for portrait A4). Display uses percentage-based CSS: `(value / canvasDim) * 100%`. Scale factor for drag: `containerWidth / canvasWidth`.

### Error Handling

Image loading, IndexedDB, and API calls use try/catch with `console.error`. UI remains functional on failure. Cloud sync errors show "Retry" status.

---

## Configuration & Environment

### `next.config.ts`

React Compiler enabled (`reactCompiler: true`).

### `tsconfig.json`

Strict mode. Path alias `@/*` → `./src/*`. Target ES2017.

### `drizzle.config.ts`

Turso dialect, schema at `./src/lib/schema.ts`, Drizzle output at `./drizzle`. DB credentials from env vars.

### `.env` / `.env.local`

`.env` is a template with placeholder values (no secrets, safe to commit). `.env.local` contains real secrets and is gitignored. Both `.env*` and `.env*.local` patterns are in `.gitignore`.

---

## Deployment

### Vercel

The app is deployed to Vercel at `moodboard-generator-phi.vercel.app`.

**Environment variables** must be set in the Vercel dashboard (not just `.env` files):
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `PINATA_JWT`
- `PINATA_GATEWAY`
- `APP_DOMAIN`

Use `printf "value" | vercel env add VAR_NAME production` (not `echo`, which adds trailing newlines).

### Database

Turso database: `moodboard-db`. Push schema changes with `npm run db:push`.

### Farcaster

- Update `public/.well-known/farcaster.json` with real `accountAssociation` values
- Update `layout.tsx` `fc:miniapp` metadata URLs to deployed domain
- Deploy OG/splash/icon images

---

## Current Status

All features are implemented and the project builds cleanly with no TypeScript errors. Only linter warnings remain — CSS inline style warnings on elements that require dynamic styling, which are expected.

### Fully Implemented

**Core Features:**
- Image upload with validation (4–20 images, JPEG/PNG/WebP/GIF)
- Auto-generate collage with organic scatter algorithm
- Interactive manual canvas (drag, resize, pin, delete, layer)
- Canvas orientation toggle (portrait A4, landscape A4, square)
- Memory-optimized undo/redo (50-step history, lightweight snapshots, keyboard shortcuts)
- Background color picker with 5 presets + color extraction
- White margin toggle
- 5 built-in templates + save custom templates
- Add images directly in manual mode via file picker

**Data & Organization:**
- Save to collection with visual thumbnail previews
- Collection grid view with search, category filter, sort
- Delete confirmation dialog
- Pin favorite moodboards to top
- Duplicate artwork
- Moodboard categorization (10 defaults + custom)
- Image library with search, tags, multi-select, deduplication
- Auto-save draft (every 30s, recovery on app load)

**Cloud & Sync:**
- Farcaster Quick Auth (server-side JWT verification)
- Cloud sync via Turso + Pinata IPFS
- Incremental sync (only push modified artworks)
- Parallel image uploads/downloads (max 3 concurrent)
- Client-side image compression before IPFS upload
- Auto-sync on login

**Export & Sharing:**
- Download PNG / Save to Camera Roll (Web Share API on mobile)
- Print with dedicated print layout
- Cast to Farcaster with IPFS image embed
- Step-by-step cast status feedback

**Security:**
- Origin validation on all API routes
- Rate limiting on public endpoints (10 req/min per IP)
- Secrets in `.env.local` only (gitignored)
- Input validation and sanitization on all API routes
- Ownership verification on sync (fid from JWT)

**Farcaster Integration:**
- Mini App SDK (`sdk.actions.ready()`, `composeCast()`)
- `fc:miniapp` metadata + `farcaster.json` manifest
- User context detection (FID, username, PFP)
- Quick Auth for authenticated API calls
- Auth preconnect for faster load

### Not Yet Implemented

- Pinch-to-zoom gesture for mobile resize (uses +/- buttons)
- Image rotation controls (manual rotation UI)
- Multi-select / batch operations on canvas
- Canvas zoom/pan for detailed work
- Client-side encryption for private moodboards
- Offline queue for sync (changes are lost if sync fails offline)
- Data export (JSON + images ZIP)
- PWA / service worker for offline use
- Collaborative moodboards
