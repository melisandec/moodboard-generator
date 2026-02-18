# Moodboard Generator — Project Context

A Farcaster mini-app for creating, composing, and sharing moodboard collages. Users upload images, arrange them on an interactive canvas, and export or cast the result to Farcaster. Built mobile-first with an ultra-minimalist interface where the artwork is always the focal point.

---

## Table of Contents

- [Moodboard Generator — Project Context](#moodboard-generator--project-context)
  - [Table of Contents](#table-of-contents)
  - [Tech Stack](#tech-stack)
  - [Project Structure](#project-structure)
    - [File Responsibilities](#file-responsibilities)
  - [Application Flow](#application-flow)
  - [Feature Reference](#feature-reference)
    - [Image Upload \& Validation](#image-upload--validation)
    - [Auto-Generate Mode](#auto-generate-mode)
    - [Interactive Manual Mode](#interactive-manual-mode)
    - [Canvas Orientation](#canvas-orientation)
    - [Undo / Redo History](#undo--redo-history)
    - [Background Color Picker](#background-color-picker)
    - [Color Extraction](#color-extraction)
    - [Image Margin Control](#image-margin-control)
    - [Templates](#templates)
    - [Save to Collection](#save-to-collection)
    - [Duplicate Artwork](#duplicate-artwork)
    - [Export: Download, Print, Cast](#export-download-print-cast)
    - [Farcaster Integration](#farcaster-integration)
  - [Data Model](#data-model)
    - [CanvasImage](#canvasimage)
    - [Artwork](#artwork)
    - [Template](#template)
  - [Storage Architecture](#storage-architecture)
  - [Canvas Rendering Pipeline](#canvas-rendering-pipeline)
    - [Auto-Generate Mode](#auto-generate-mode-1)
    - [Manual Mode (Export)](#manual-mode-export)
    - [Image Compression (for storage)](#image-compression-for-storage)
  - [Design System \& Style Guide](#design-system--style-guide)
    - [Philosophy](#philosophy)
    - [Colors](#colors)
    - [Typography](#typography)
    - [Spacing \& Layout](#spacing--layout)
    - [Interactive Elements](#interactive-elements)
    - [Icons](#icons)
  - [Mobile \& Touch Optimization](#mobile--touch-optimization)
  - [Conventions \& Patterns](#conventions--patterns)
    - [State Management](#state-management)
    - [Callbacks](#callbacks)
    - [Component Communication](#component-communication)
    - [ID Generation](#id-generation)
    - [Coordinate System](#coordinate-system)
    - [Inline Styles](#inline-styles)
    - [Error Handling](#error-handling)
  - [Configuration Files](#configuration-files)
    - [`next.config.ts`](#nextconfigts)
    - [`tsconfig.json`](#tsconfigjson)
    - [`postcss.config.mjs`](#postcssconfigmjs)
    - [`globals.css`](#globalscss)
  - [Deployment Considerations](#deployment-considerations)
  - [Current Status](#current-status)
    - [Fully Implemented](#fully-implemented)
    - [Not Yet Implemented](#not-yet-implemented)

---

## Tech Stack

| Layer      | Technology                          | Version |
| ---------- | ----------------------------------- | ------- |
| Framework  | Next.js (App Router, Turbopack)     | 16.1.6  |
| UI Library | React                               | 19.2.3  |
| Language   | TypeScript (strict mode)            | ^5      |
| Styling    | Tailwind CSS v4 (via PostCSS)       | ^4      |
| Font       | Geist Sans (Google Fonts, variable) | —       |
| Compiler   | React Compiler (babel plugin)       | 1.0.0   |
| Storage    | IndexedDB (client-side)             | —       |
| Canvas     | HTML5 Canvas API                    | —       |

Zero runtime dependencies beyond React and Next.js. No component library, no state management library, no image processing library — everything is hand-rolled to keep the bundle minimal.

---

## Project Structure

```
moodboard-generator/
├── public/
│   └── .well-known/
│       └── farcaster.json          # Farcaster Frame v2 manifest
├── src/
│   ├── app/
│   │   ├── globals.css             # Global styles, CSS variables, utilities
│   │   ├── layout.tsx              # Root layout, viewport meta, OG + Frame metadata
│   │   └── page.tsx                # Renders <MoodboardGenerator />
│   ├── components/
│   │   ├── MoodboardGenerator.tsx  # Main app component (views, state, all features)
│   │   └── InteractiveCanvas.tsx   # Drag/resize/pin canvas for manual mode
│   └── lib/
│       ├── storage.ts              # IndexedDB wrapper, TypeScript interfaces
│       ├── canvas.ts               # Image loading, rendering, compression, color extraction
│       └── templates.ts            # Built-in templates, apply/create/preview utilities
├── next.config.ts                  # React Compiler enabled
├── tsconfig.json                   # Strict, path alias @/* → ./src/*
├── postcss.config.mjs              # @tailwindcss/postcss plugin
└── package.json
```

### File Responsibilities

**`src/lib/storage.ts`** — Data layer. Defines all TypeScript interfaces (`CanvasImage`, `Artwork`, `Template`, `Orientation`, `TemplateSlot`). Wraps IndexedDB with generic `idbPut`, `idbGetAll`, `idbDelete` helpers. Exposes CRUD functions for both `artworks` and `templates` object stores.

**`src/lib/canvas.ts`** — Image processing and rendering. Contains the auto-generate collage algorithm (`generatePlacements`), the manual-mode renderer (`renderManualMoodboard`), image compression for storage (`compressForStorage`), initial scatter layout (`createInitialPlacements`), and the dominant color extraction pipeline (`extractColors`).

**`src/lib/templates.ts`** — Template system. Defines canvas dimensions per orientation (`CANVAS_DIMS`), the 5 built-in templates (`BUILT_IN_TEMPLATES`), functions to apply templates to images, convert artwork layouts to reusable templates, rescale images across orientation changes, and generate SVG preview thumbnails.

**`src/components/InteractiveCanvas.tsx`** — The interactive A4 canvas. Handles pointer-event-based drag, selection, resize (+/- buttons), pin/unpin toggle, delete, and z-index layering. Renders images as absolutely positioned divs with percentage-based coordinates derived from the logical canvas dimensions. Accepts `bgColor`, `imageMargin`, and `onCommit` props from the parent.

**`src/components/MoodboardGenerator.tsx`** — The entire application UI. Manages three views (`create`, `auto-result`, `manual`), all application state, undo/redo stacks, toolbar panels (orientation, BG color, margin, templates), the saved artworks collection, and all export actions. This is a single `'use client'` component that orchestrates everything.

---

## Application Flow

The app has a three-view architecture controlled by a `view` state variable:

```
┌─────────────────────────────────────────────────┐
│                  CREATE VIEW                     │
│                                                  │
│   Title input → Caption input → Upload images    │
│                                                  │
│   [Generate]          [Arrange]                  │
│                                                  │
│   ─── Saved Collection ───                       │
│   Artwork 1  [Duplicate] [Delete]                │
│   Artwork 2  [Duplicate] [Delete]                │
└────────┬──────────────────────┬──────────────────┘
         │                      │
    ┌────▼──────┐         ┌─────▼─────────────────┐
    │ AUTO-     │         │ MANUAL VIEW            │
    │ RESULT    │         │                        │
    │           │         │ [←] [Undo][Redo] [Save]│
    │ ← Back   │         │ [A4P][A4L][□] BG Margin│
    │ Refresh   │         │ Templates              │
    │           │         │ ┌──────────────────┐   │
    │ [image]   │         │ │  Interactive     │   │
    │           │         │ │  Canvas          │   │
    │ Save      │         │ └──────────────────┘   │
    │ Print     │         │ [image controls]       │
    │ Cast      │         │ Save / Print / Cast    │
    └───────────┘         └────────────────────────┘
```

**Create → Auto-Result**: User clicks "Generate". Files are loaded into `HTMLImageElement`s, passed through the auto-placement algorithm, and rendered to a single PNG data URL.

**Create → Manual**: User clicks "Arrange". Files are compressed to JPEG data URLs (`compressForStorage`), scattered on the canvas (`createInitialPlacements`), and the manual view opens.

**Collection → Manual**: User taps a saved artwork. All stored `CanvasImage` data, orientation, background color, and margin settings are restored into state.

---

## Feature Reference

### Image Upload & Validation

- Minimum 4, maximum 20 images
- Accepted formats: JPEG, PNG, WebP, GIF
- Hidden `<input type="file" multiple>` triggered by a tap-to-upload area
- Horizontal scrollable thumbnail strip with individual remove buttons
- Counter display: `5/20`
- Title is required; caption is optional
- "Generate" and "Arrange" buttons appear only when `title.trim()` is non-empty and `files.length >= 4`

### Auto-Generate Mode

Renders a collage to an off-screen `<canvas>` using `renderMoodboard()`.

**Placement algorithm** (`generatePlacements`):

1. Compute a grid based on image count and canvas aspect ratio
2. For each image, assign a grid cell with random size multiplier (0.82–1.38×, with 22% chance of 1.35× bonus)
3. Add random offset within the cell (±55% of cell size)
4. Clamp positions to keep at least 90% of each image on-canvas
5. Apply random rotation (±3°)
6. Shuffle the draw order for natural overlapping
7. Each image gets a white border and subtle shadow

Title and caption are rendered in light type at the bottom-left.

The user can **regenerate** (refresh icon) to get a new random arrangement without re-uploading.

### Interactive Manual Mode

The `InteractiveCanvas` component provides a fully interactive composition surface.

**Drag**: Pointer Events (`pointerdown` → window-level `pointermove`/`pointerup`). The scale factor between display pixels and logical canvas pixels is computed from `containerRef.clientWidth / canvasWidth`. Coordinates are stored in logical canvas space.

**Selection**: Tapping an image selects it (blue ring indicator). Tapping the canvas background deselects. Selected images are automatically brought to front (highest z-index).

**Resize**: +/- buttons scale width by 0.85× or 1.18× while maintaining aspect ratio. Clamped between 30px and 95% of canvas width. Disabled for pinned images.

**Pin/Unpin**: Locks an image in place. Pinned images cannot be dragged or resized. A pin icon appears in the top-right corner.

**Delete**: Removes the selected image from the canvas.

**Layering**: Images render in z-index order. Selecting an image automatically gives it the highest z-index.

### Canvas Orientation

Three options, each defining logical canvas dimensions in `CANVAS_DIMS`:

| Orientation | Dimensions  | Aspect Ratio |
| ----------- | ----------- | ------------ |
| Portrait    | 1080 × 1527 | 1 : √2 (A4)  |
| Landscape   | 1527 × 1080 | √2 : 1 (A4)  |
| Square      | 1080 × 1080 | 1 : 1        |

When switching orientation, `rescaleImages()` proportionally maps all positions and sizes:

- Positions scale by `newDim / oldDim` per axis
- Sizes scale by `min(scaleX, scaleY)` to prevent distortion

The current orientation is saved with the artwork and restored on load.

### Undo / Redo History

Tracks up to 50 state snapshots (`CanvasImage[]` arrays).

**When snapshots are captured** (via `commitSnapshot` → `onCommit` callback):

- Before a drag starts (on `pointerdown`)
- Before each resize click
- Before pin toggle
- Before delete
- Before orientation switch
- Before template application

**Keyboard shortcuts**: `Cmd+Z` / `Ctrl+Z` for undo, `Cmd+Shift+Z` / `Ctrl+Y` for redo. Only active in manual view.

**Button states**: Undo/redo buttons are visually dimmed (`opacity-25`) when their respective stacks are empty.

History is cleared when loading a new artwork, entering manual mode, or duplicating.

### Background Color Picker

An expandable panel toggled by the "BG" button in the toolbar.

**5 preset swatches**:
| Color | Hex | Purpose |
|----------|-----------|------------------|
| White | `#FFFFFF` | Pure clean |
| Off-white| `#F8F8F8` | Softer white |
| Light gray| `#F0F0F0`| Subtle contrast |
| Warm | `#FAF9F6` | Warm off-white |
| Black | `#000000` | High contrast |

The active color shows a scaled-up ring indicator. Background color applies to the canvas container via inline `backgroundColor` style and is included in exported PNGs.

When a dark background is selected (`luminance < 128`), the title/caption text automatically switches to light colors for readability.

### Color Extraction

Triggered by the "Extract" link in the BG color picker.

**Pipeline** (`extractColors` in `canvas.ts`):

1. Sample up to 8 canvas images
2. Draw each at 6×6 pixels (natural averaging)
3. Read pixel data, skip near-black (`< 30`) and near-white (`> 225`)
4. Quantize to 48-value buckets per channel
5. Accumulate RGB sums per bucket
6. Sort buckets by pixel count (most dominant first)
7. For each dominant color, convert RGB → HSL, then:
   - Reduce saturation to 15% of original
   - Push lightness to 92–97%
   - Convert back to RGB hex
8. Filter out colors that are too similar to already-selected ones (Manhattan distance < 30)
9. Return up to 3 muted background-appropriate colors

Extracted colors appear as additional swatches alongside the presets.

### Image Margin Control

A toggle button ("Margin") in the toolbar.

**Display**: Uses CSS `box-shadow: 0 0 0 3px white` on each image element — no layout shift.

**Export**: In `renderManualMoodboard`, when margin is enabled, a white `fillRect` slightly larger than the image is drawn before each image. Border width is `max(2, canvasWidth * 0.003)` pixels.

The margin state is saved with artwork and restored on load.

### Templates

Accessible via a bottom-sheet modal triggered by "Templates" in the toolbar.

**5 built-in templates**:

- **Blank** — Empty canvas, images scatter randomly
- **Centered** — Single large image at center
- **Diagonal** — 4 images along a diagonal
- **Scattered** — 7 images distributed across canvas
- **Corners** — 5 images emphasizing corners and center

**Template data model**: Each slot defines `cx`, `cy` (center as 0–1 fractions), `scale` (width as fraction of canvas width), `rotation`, and `zIndex`. Image height is computed from the slot width and the image's aspect ratio.

**Applying a template**: Images cycle through slots if there are more images than slots. Each placement gets a slight random rotation jitter (±0.4°) for organic feel.

**Save as template**: Captures the current canvas layout as relative positions. User provides a name. Stored in the `templates` IndexedDB object store.

**Preview generation**: `templatePreviewSvg()` produces inline SVG with gray rectangles representing slot positions, rendered as data-URL `<img>` elements in the template grid.

User templates can be deleted; built-in templates cannot.

### Save to Collection

"Save" button in the manual view header. Persists the complete editable state:

- Title, caption
- All `CanvasImage` objects (including data URLs)
- Canvas dimensions
- Orientation, background color, margin setting
- Creation and update timestamps

If editing an existing artwork (matching `artworkId`), it updates in place. Otherwise creates a new entry with a generated ID.

After saving, a brief "Saved" indicator appears for 1.5 seconds.

The saved collection is listed at the bottom of the Create view, sorted by most recently updated. Each entry shows title, image count, and date.

### Duplicate Artwork

Available in the Create view collection list. Creates a new artwork with:

- Title: `"Copy of [original title]"`
- All images with new unique IDs
- Same orientation, background color, margin settings
- No `artworkId` (treated as new)

Opens immediately in manual mode for editing.

### Export: Download, Print, Cast

Three export actions available in both auto-result and manual views:

**Download**: Renders to PNG data URL, creates a temporary `<a>` element with `download` attribute, triggers click. Filename derived from title: `my-moodboard.png`.

**Print**: Opens a new browser window with the PNG in a print-optimized HTML page. Auto-triggers `window.print()` after 350ms.

**Cast to Farcaster**: Opens `https://warpcast.com/~/compose?text=...` with title and caption pre-filled. The user downloads the image separately and attaches it manually (Farcaster compose doesn't support direct image data URL embedding).

For manual mode exports, `renderManualMoodboard` renders all images at their exact positions, sizes, rotations, and z-order onto an off-screen canvas, respecting the current background color and margin settings.

### Farcaster Integration

**Frame v2 metadata** in `layout.tsx`:

```json
{
  "version": "next",
  "imageUrl": "https://moodboard.example.com/og.png",
  "button": {
    "title": "Create Moodboard",
    "action": {
      "type": "launch_frame",
      "name": "Moodboard Generator",
      "url": "https://moodboard.example.com"
    }
  }
}
```

**Frame manifest** at `public/.well-known/farcaster.json`: Contains placeholder values for `accountAssociation` (header, payload, signature) that must be replaced with real values before deployment.

The URLs (`moodboard.example.com`) are placeholders that need to be updated to the actual deployed domain.

---

## Data Model

### CanvasImage

```typescript
interface CanvasImage {
  id: string; // Unique ID (e.g., "img-1708000000000-abc123")
  dataUrl: string; // JPEG data URL (compressed to max 1000px, 80% quality)
  x: number; // Logical x position on canvas
  y: number; // Logical y position on canvas
  width: number; // Logical width
  height: number; // Logical height
  rotation: number; // Degrees
  pinned: boolean; // Lock state
  zIndex: number; // Layer order
  naturalWidth: number; // Original (compressed) width
  naturalHeight: number; // Original (compressed) height
}
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
  orientation: Orientation; // 'portrait' | 'landscape' | 'square'
  bgColor: string; // Hex color
  imageMargin: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
```

### Template

```typescript
interface TemplateSlot {
  cx: number; // Center x as fraction (0–1)
  cy: number; // Center y as fraction (0–1)
  scale: number; // Width as fraction of canvas width
  rotation: number; // Degrees
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

**IndexedDB** is used for all persistent client-side data. The database name is `moodboard-artworks` at version 2.

| Object Store | Key Path | Content                                          |
| ------------ | -------- | ------------------------------------------------ |
| `artworks`   | `id`     | Full `Artwork` objects including image data URLs |
| `templates`  | `id`     | User-created `Template` objects (no image data)  |

IndexedDB was chosen over `localStorage` because artwork objects contain compressed image data URLs which can easily exceed localStorage's ~5–10MB limit.

The `openDB()` helper handles version upgrades gracefully — both stores are created in the `onupgradeneeded` handler with existence checks.

Generic helpers (`idbPut`, `idbGetAll`, `idbDelete`) avoid code duplication across stores.

**Backward compatibility**: When loading artworks saved before the orientation/bgColor/imageMargin fields existed, the component defaults to `orientation: 'portrait'`, `bgColor: '#f5f5f4'`, `imageMargin: false` via nullish coalescing.

---

## Canvas Rendering Pipeline

### Auto-Generate Mode

```
File[] → loadImage() → HTMLImageElement[] → generatePlacements() → Placement[]
  → render to off-screen canvas (white border + shadow per image)
  → drawTitleCaption()
  → canvas.toDataURL('image/png')
```

### Manual Mode (Export)

```
CanvasImage[] → loadImageFromUrl() per dataUrl → HTMLImageElement[]
  → sort by zIndex
  → fill canvas with bgColor
  → for each image: translate, rotate, optional margin fillRect, drawImage
  → drawTitleCaption() (auto-detects dark bg for text color)
  → canvas.toDataURL('image/png')
```

### Image Compression (for storage)

```
File → createObjectURL → new Image() → resize to max 1000px
  → draw to temp canvas → toDataURL('image/jpeg', 0.8)
  → { dataUrl, naturalWidth, naturalHeight }
```

---

## Design System & Style Guide

### Philosophy

Ultra-minimalist. The interface should be "almost invisible" — the user's images and composition are the complete focus. Every UI element exists only because it's necessary.

### Colors

| Usage             | Color        | Tailwind Class       |
| ----------------- | ------------ | -------------------- |
| Background        | `#FFFFFF`    | `bg-white`           |
| Primary text      | `#404040`    | `text-neutral-700`   |
| Secondary text    | `#737373`    | `text-neutral-500`   |
| Muted text        | `#a3a3a3`    | `text-neutral-400`   |
| Borders           | `#d4d4d4`    | `border-neutral-300` |
| Light borders     | `#e5e5e5`    | `border-neutral-200` |
| Canvas default BG | `#f5f5f4`    | `bg-stone-100`       |
| Selection ring    | Blue 400/50% | `ring-blue-400/50`   |
| Danger hover      | Red 500      | `hover:text-red-500` |
| Success feedback  | Green 600    | `text-green-600`     |

No shadows, gradients, or decorative elements in the UI. Only the auto-generated collage mode uses subtle shadows on images.

### Typography

- **Font**: Geist Sans (variable, loaded via `next/font/google`)
- **Weights**: 300 (light) for body text, 400 (regular) for headings
- **Sizes**: `text-lg` for title input, `text-sm` for body, `text-[11px]` for labels and counts, `text-[10px]` for template names
- **Labels**: 11px uppercase tracking-widest for section headers (e.g., "MOODBOARD", "SAVED", "TEMPLATES")

### Spacing & Layout

- Max content width: `max-w-lg` (32rem / 512px)
- Page padding: `px-5 py-6` on create view, `px-4` in manual view
- Gap between sections: `gap-5`
- Touch targets: Minimum `44px × 44px` (`min-h-[44px] min-w-[44px]`)

### Interactive Elements

- **Buttons**: Thin outline (`border border-neutral-300`) or plain text. No fills, no shadows. Rounded pill for save/pin (`rounded-full`), rounded-sm for primary actions.
- **Inputs**: Bottom-border only, no box. Placeholder as the only label.
- **Upload area**: Dashed border, centered plus icon.
- **Toolbar buttons**: 32px height, 11px text, subtle background on active state (`bg-neutral-100`).
- **Bottom sheet**: Semi-transparent overlay (`bg-black/15`), white panel with rounded top corners, drag handle bar.

### Icons

All icons are inline SVGs with `stroke="currentColor"`, `strokeWidth="1.5"`, no fill. Sizes: 20px for action bar, 18px for undo/redo, 16px for canvas controls, 14px for collection actions, 12px for pin indicator.

---

## Mobile & Touch Optimization

- **Viewport**: `maximumScale: 1`, `userScalable: false` — prevents accidental zoom during canvas interaction
- **Touch targets**: All interactive elements are at least 44×44px
- **Tap highlight**: Disabled globally (`-webkit-tap-highlight-color: transparent`)
- **Canvas interaction**: `touch-none` class prevents browser scroll/zoom during drag. `select-none` prevents text selection.
- **Pointer Events**: Used instead of mouse/touch events for unified handling across devices.
- **Window-level listeners**: Drag `pointermove`/`pointerup` are on `window` so dragging continues smoothly even if the pointer leaves the image element.
- **Overscroll**: `overscroll-behavior: none` prevents pull-to-refresh on mobile.
- **Scrollbar hiding**: `.scrollbar-hide` utility for horizontal thumbnail strips and toolbar overflow.
- **100dvh**: Uses `min-h-[100dvh]` to account for mobile browser chrome.

---

## Conventions & Patterns

### State Management

All state lives in `MoodboardGenerator` using React `useState`. No external state library. The `InteractiveCanvas` is a controlled component receiving `images` and calling `onChange`.

### Callbacks

All event handlers and derived functions use `useCallback` with explicit dependency arrays. This works with the React Compiler (`reactCompiler: true` in next.config) for automatic memoization.

### Component Communication

- Parent → Child: Props (`images`, `onChange`, `onCommit`, `bgColor`, `imageMargin`, `canvasWidth`, `canvasHeight`)
- Child → Parent: Callback invocations (`onChange` for real-time updates, `onCommit` for undo snapshots)

### ID Generation

All entity IDs use the pattern: `prefix-timestamp-randomAlpha6`, e.g., `img-1708000000000-x7k2m9`, `artwork-1708000000000-abc123`, `tpl-1708000000000-def456`.

### Coordinate System

The canvas uses a logical coordinate system (e.g., 1080×1527 for portrait A4). Display uses percentage-based CSS positioning derived from `(value / canvasDim) * 100%`. The scale factor (`containerWidth / canvasWidth`) converts between display and logical coordinates during drag.

### Inline Styles

Dynamic positioning, sizing, rotation, and background colors use inline `style` objects because they vary per-element and per-frame. Tailwind handles all static styling.

### Error Handling

Image loading and IndexedDB operations use try/catch with `console.error`. UI remains functional on failure — no error modals.

---

## Configuration Files

### `next.config.ts`

React Compiler enabled for automatic memoization.

### `tsconfig.json`

Strict mode. Path alias `@/*` maps to `./src/*`. Target ES2017.

### `postcss.config.mjs`

Single plugin: `@tailwindcss/postcss` (Tailwind CSS v4).

### `globals.css`

- CSS variables: `--background: #ffffff`, `--foreground: #171717`
- Tailwind theme inline: maps CSS vars to Tailwind tokens
- Global: tap highlight removal, font smoothing, overscroll behavior
- Utility: `.scrollbar-hide` for cross-browser scrollbar hiding

---

## Deployment Considerations

Before deploying, update the following placeholders:

1. **`public/.well-known/farcaster.json`**: Replace `accountAssociation` fields (`header`, `payload`, `signature`) with real Farcaster account association data. Update all `moodboard.example.com` URLs.

2. **`src/app/layout.tsx`**: Update `fc:frame` metadata URLs (`imageUrl`, `url`) to the actual deployed domain.

3. **OG/Splash images**: Create and deploy `og.png`, `icon.png`, and `splash.png` assets referenced in the Farcaster metadata.

The app is entirely client-side rendered (`'use client'` components). The only server-side aspect is the static page shell from Next.js. No API routes, no server actions, no database — all data stays in the user's browser via IndexedDB.

---

## Current Status

All features are implemented and the project builds cleanly with no TypeScript errors. Only linter warnings remain — all are CSS inline style warnings on elements that require dynamic styling (canvas image positions, color swatches), which are expected and acceptable.

### Fully Implemented

- Image upload with validation (4–20 images)
- Auto-generate collage with organic scatter algorithm
- Interactive manual canvas (drag, resize, pin, delete, layer)
- Canvas orientation toggle (portrait, landscape, square)
- Undo/redo with 50-step history and keyboard shortcuts
- Background color picker with 5 presets
- Dominant color extraction from images
- White margin toggle for images
- 5 built-in templates + save custom templates
- Save to collection (IndexedDB persistence)
- Load saved artwork for continued editing
- Duplicate artwork
- Download as PNG
- Print with dedicated print layout
- Cast to Farcaster via Warpcast deep link
- Farcaster Frame v2 metadata (placeholder URLs)
- Mobile-first responsive design
- Touch-optimized interactions

### Not Yet Implemented

- Farcaster account association (requires real credentials for `farcaster.json`)
- OG/splash image assets for Frame metadata
- Actual deployment and domain configuration
- Pinch-to-zoom gesture for mobile resize (uses +/- buttons instead)
- Image rotation controls (only initial random rotation; no manual rotation UI)
- Multi-select / batch operations on canvas
- Canvas zoom/pan for detailed work
