# Phase 2: Parcel Draw Tool + Buyer Sidebar

## Context

The El Pela parcel viewer has 5 hardcoded parcels in `data/parcels.json`. The developer needs to trace 10-30 parcel boundaries over Google 3D satellite imagery for the MVP. Buyers need a better way to view parcel details than the current floating card.

Two features:
1. **Draw Tool** — dev-only polygon tracing tool, activated via `?draw=true`
2. **Buyer Sidebar** — slide-in panel replacing the floating ParcelCard

## Feature 1: Draw Tool

### Activation
- URL parameter `?draw=true` shows the draw toolbar
- Hidden from buyers by default
- No authentication needed (dev tool, not exposed in production)

### UI: Draw Toolbar
- Fixed bar at top of screen (below TopBar)
- Buttons: "New Parcel", "Export JSON"
- When drawing: shows vertex count, "Press Enter to finish, Esc to cancel, Backspace to undo"

### Drawing Flow
1. Click "New Parcel" → cursor becomes crosshair, draw mode active
2. Click on map → raycasts to globe surface (reuse `GlobeClickHandler` raycast logic), converts to lat/lon
3. Each click adds a vertex — rendered as R3F mesh spheres on the globe surface
4. Lines connect vertices in order via `<line>` geometry in the R3F scene
5. **Enter** → closes polygon (connects last vertex to first). No double-click (conflicts with GlobeControls).
6. **Backspace** → removes last vertex
7. **Escape** → cancels current polygon, removes all vertices and line overlay
8. On close: inline form appears in toolbar area for parcel metadata

### Draw Mode Behavior
When `useDrawTool.active` is true:
- **Parcel selection is fully suppressed** — `GlobeClickHandler` early-returns from both `handleClick` and `handleMove`
- **Hover styling on existing parcels is suppressed** — no cursor changes, no highlight
- **Cursor is locked to `"crosshair"`** at all times
- GlobeControls remain active (orbit/pan/zoom still work via right-click/scroll)

### Parcel Metadata Form
After closing a polygon, a compact form appears:
- Name (text input, required) — auto-generates `id` by slugifying name (e.g. "My Parcel" → `my-parcel`). Appends `-2`, `-3` etc. if duplicate.
- Price USD (number input)
- Area m² (number input, auto-calculated from polygon using spherical excess formula)
- Zoning (dropdown: Residential, Mixed Use, Rural Residential, Commercial)
- Status (dropdown: For Sale, Sold, Reserved)
- Description (text input, one line)
- Contact URL (text input, defaults to WhatsApp template)

Submit adds the parcel to the in-memory collection and renders it on the map.

### Export
- "Export JSON" button downloads `parcels.json` with all parcels (existing + newly drawn)
- Uses `JSON.stringify(data, null, 2)` for readable, diff-friendly output
- Developer copies this file to `data/parcels.json` and commits
- Format matches existing GeoJSON FeatureCollection structure

### Vertex & Line Rendering
- Vertices: R3F `<mesh>` spheres (small, white, positioned on globe surface) — rendered at full frame rate, no throttling
- Lines: R3F `<line>` geometry connecting vertices in order
- NOT HTML overlays (avoids 100ms throttle lag from ScreenProjector)
- Both cleaned up when drawing is cancelled or polygon is finished

### Unified Parcel Data Source
Create `lib/use-parcel-data.ts` — a hook that merges static JSON parcels with in-memory drawn parcels:
```typescript
function useParcelData(): GeoJSON.FeatureCollection
```
All parcel consumers (`ParcelLayer`, `GlobeClickHandler`, `ScreenProjector`) read from this hook instead of calling `getParcels()` directly. This ensures drawn parcels appear immediately in the overlay, interaction, and screen projection systems.

### State
New Zustand store: `useDrawTool`
```typescript
interface DrawToolState {
  active: boolean                          // draw mode on/off
  vertices: [number, number][]             // [lon, lat] pairs for current polygon
  drawnParcels: GeoJSON.Feature[]          // only newly drawn parcels (not static)
  startDrawing: () => void
  addVertex: (lon: number, lat: number) => void
  removeLastVertex: () => void
  cancelDrawing: () => void
  finishPolygon: (properties: ParcelProperties) => void
  exportJSON: () => void
}
```

Persist `drawnParcels` to `localStorage` via Zustand's persist middleware to prevent data loss on accidental tab close.

### Area Calculation
Use the **spherical excess formula** (not Shoelace on degrees) for geodesic area. At José Ignacio's latitude (~34.8°S), Shoelace on raw lon/lat gives ~17% error. Spherical excess is ~20 lines of code and accurate to <1% for small polygons.

### Files to Create
- `components/draw-toolbar.tsx` — toolbar UI + metadata form
- `components/draw-overlay.tsx` — R3F vertex spheres + line geometry
- `lib/use-draw-tool.ts` — Zustand store with localStorage persist
- `lib/use-parcel-data.ts` — unified hook merging static + drawn parcels
- `lib/geo-area.ts` — spherical excess polygon area calculation

### Files to Modify
- `components/map-viewer.tsx` — conditionally render draw components when `?draw=true`
- `components/globe-click-handler.tsx` — early-return when `useDrawTool.active` is true; in draw mode, clicks call `addVertex` instead
- `components/parcel-layer.tsx` — read from `useParcelData()` instead of `getParcels()`
- `components/screen-projector.tsx` — read from `useParcelData()` instead of `getParcels()`

## Feature 2: Buyer Sidebar

### Replaces
- `components/parcel-card.tsx` (floating card positioned near parcel)

### UI
- Slides in from right edge, 320px wide, full viewport height
- Dark semi-transparent background (`bg-black/80 backdrop-blur`)
- Mobile: full-width bottom sheet (`max-sm:w-full max-sm:h-[50vh] max-sm:bottom-0`)
- Content sections:
  1. **Header:** Parcel name + status badge (green "For Sale", red "Sold", yellow "Reserved")
  2. **Key metrics:** Price (formatted USD), Area (m²), Zoning
  3. **Description:** One-line text
  4. **CTA:** Full-width WhatsApp/contact button
  5. **Close:** X button top-right, also closes on Escape key

### Status Badge Colors
- For Sale: green (`bg-emerald-500/20 text-emerald-400`)
- Sold: red (`bg-red-500/20 text-red-400`)
- Reserved: yellow (`bg-amber-500/20 text-amber-400`)

### Animation
- Slide in: `translate-x-full → translate-x-0` with `transition-transform duration-300`
- Backdrop: fade in `opacity-0 → opacity-100`

### Data Model Change
Add `status` field to `ParcelProperties`:
```typescript
interface ParcelProperties {
  id: string
  name: string
  areaSqMeters: number
  priceUSD: number
  zoning: string
  status: 'for-sale' | 'sold' | 'reserved'  // NEW
  description?: string
  contactUrl: string
  color?: string
}
```

Default existing parcels to `status: 'for-sale'`.

### Files to Create
- `components/parcel-sidebar.tsx` — sidebar component

### Files to Modify
- `components/map-viewer.tsx` — replace ParcelCard with ParcelSidebar
- `lib/parcels.ts` — add status to ParcelProperties type
- `data/parcels.json` — add status field to existing parcels

## Verification
1. Add `?draw=true` to URL — toolbar should appear
2. Click "New Parcel" → click 4+ points on map → Enter → fill form → see parcel rendered
3. Click "Export JSON" → verify downloaded file has correct GeoJSON structure
4. Close tab, reopen with `?draw=true` → drawn parcels restored from localStorage
5. Remove `?draw=true` → toolbar gone, drawn parcels still visible (if in parcels.json)
6. Click any parcel → sidebar slides in with correct info
7. Press Escape or click X → sidebar closes
8. Status badges show correct colors for each status
9. On mobile: sidebar shows as bottom sheet
