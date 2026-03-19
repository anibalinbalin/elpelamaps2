# Phase 2: Draw Tool + Buyer Sidebar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a developer-only polygon draw tool for tracing parcel boundaries on the 3D map, and a buyer-facing sidebar for viewing parcel details.

**Architecture:** The draw tool is activated via `?draw=true` URL parameter and uses the existing raycast-to-latlon pipeline. A unified `useParcelData()` hook merges static JSON parcels with in-memory drawn parcels so all consumers see the same data. The buyer sidebar replaces the floating ParcelCard with a slide-in panel.

**Tech Stack:** Next.js 16, React Three Fiber, Zustand (with persist), 3d-tiles-renderer, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-19-draw-tool-sidebar-design.md`

---

### Task 1: Add `status` field to data model

**Files:**
- Modify: `lib/parcels.ts` — add `status` to `ParcelProperties`
- Modify: `data/parcels.json` — add `status: "for-sale"` to all 5 parcels

- [ ] **Step 1: Update ParcelProperties type**

In `lib/parcels.ts`, add `status` to the interface:

```typescript
export interface ParcelProperties {
  id: string;
  name: string;
  areaSqMeters: number;
  priceUSD: number;
  zoning: string;
  status: "for-sale" | "sold" | "reserved";
  description?: string;
  contactUrl: string;
  color?: string;
}
```

- [ ] **Step 2: Add status to existing parcels**

In `data/parcels.json`, add `"status": "for-sale"` to each feature's properties.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: Clean

- [ ] **Step 4: Commit**

```bash
git add lib/parcels.ts data/parcels.json
git commit -m "feat: add status field to parcel data model"
```

---

### Task 2: Create unified parcel data hook

**Files:**
- Create: `lib/use-parcel-data.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useMemo } from "react";
import { getParcels, type ParcelCollection, type ParcelFeature } from "./parcels";
import { useDrawTool } from "./use-draw-tool";

/**
 * Unified parcel data source.
 * Merges static JSON parcels with in-memory drawn parcels.
 * All parcel consumers should use this instead of getParcels() directly.
 */
export function useParcelData(): ParcelCollection {
  const drawnParcels = useDrawTool((s) => s.drawnParcels);
  const staticParcels = useMemo(() => getParcels(), []);

  return useMemo(() => {
    if (drawnParcels.length === 0) return staticParcels;
    return {
      type: "FeatureCollection" as const,
      features: [...staticParcels.features, ...drawnParcels] as ParcelFeature[],
    };
  }, [staticParcels, drawnParcels]);
}
```

Note: This depends on `useDrawTool` which is created in Task 3. Create `useDrawTool` as a stub first if needed, or implement Tasks 2 and 3 together.

- [ ] **Step 2: Commit**

```bash
git add lib/use-parcel-data.ts
git commit -m "feat: add unified parcel data hook"
```

---

### Task 3: Create draw tool Zustand store

**Files:**
- Create: `lib/use-draw-tool.ts`
- Create: `lib/geo-area.ts`

- [ ] **Step 1: Create spherical area calculator**

Create `lib/geo-area.ts`:

```typescript
/**
 * Compute the geodesic area of a polygon ring using the spherical excess formula.
 * Input: ring as [lon, lat][] in degrees.
 * Returns: area in square meters.
 */
const EARTH_RADIUS = 6371008.8;

export function sphericalArea(ring: [number, number][]): number {
  const coords = ring.map(([lon, lat]) => [
    (lon * Math.PI) / 180,
    (lat * Math.PI) / 180,
  ]);

  const n = coords.length;
  if (n < 3) return 0;

  let sum = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const k = (i + 2) % n;
    sum += (coords[k][0] - coords[i][0]) * Math.sin(coords[j][1]);
  }

  return Math.abs(sum * EARTH_RADIUS * EARTH_RADIUS * 0.5);
}
```

- [ ] **Step 2: Create draw tool store**

Create `lib/use-draw-tool.ts`:

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ParcelProperties, ParcelFeature } from "./parcels";
import { getParcels } from "./parcels";
import { sphericalArea } from "./geo-area";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function uniqueId(name: string, existing: string[]): string {
  const base = slugify(name);
  if (!existing.includes(base)) return base;
  let i = 2;
  while (existing.includes(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

interface DrawToolState {
  active: boolean;
  vertices: [number, number][]; // [lon, lat] pairs
  drawnParcels: ParcelFeature[];
  startDrawing: () => void;
  addVertex: (lon: number, lat: number) => void;
  removeLastVertex: () => void;
  cancelDrawing: () => void;
  finishPolygon: (props: Omit<ParcelProperties, "id" | "areaSqMeters">) => void;
  exportJSON: () => void;
}

export const useDrawTool = create<DrawToolState>()(
  persist(
    (set, get) => ({
      active: false,
      vertices: [],
      drawnParcels: [],

      startDrawing: () => set({ active: true, vertices: [] }),

      addVertex: (lon, lat) =>
        set((s) => ({ vertices: [...s.vertices, [lon, lat]] })),

      removeLastVertex: () =>
        set((s) => ({ vertices: s.vertices.slice(0, -1) })),

      cancelDrawing: () => set({ active: false, vertices: [] }),

      finishPolygon: (props) => {
        const { vertices, drawnParcels } = get();
        if (vertices.length < 3) return;

        const ring = [...vertices, vertices[0]]; // close the ring
        const allIds = [
          ...getParcels().features.map((f) => f.properties.id),
          ...drawnParcels.map((f) => f.properties.id),
        ];
        const id = uniqueId(props.name, allIds);
        const areaSqMeters = Math.round(sphericalArea(ring));

        const feature: ParcelFeature = {
          type: "Feature",
          properties: { ...props, id, areaSqMeters },
          geometry: { type: "Polygon", coordinates: [ring] },
        };

        set({
          active: false,
          vertices: [],
          drawnParcels: [...drawnParcels, feature],
        });
      },

      exportJSON: () => {
        const { drawnParcels } = get();
        const staticParcels = getParcels();
        const merged = {
          ...staticParcels,
          features: [...staticParcels.features, ...drawnParcels],
        };
        const blob = new Blob(
          [JSON.stringify(merged, null, 2)],
          { type: "application/json" }
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "parcels.json";
        a.click();
        URL.revokeObjectURL(url);
      },
    }),
    {
      name: "elpela-draw-tool",
      partialize: (state) => ({ drawnParcels: state.drawnParcels }),
    }
  )
);
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add lib/geo-area.ts lib/use-draw-tool.ts
git commit -m "feat: add draw tool store with localStorage persist"
```

---

### Task 4: Wire parcel consumers to unified data hook

**Files:**
- Modify: `components/parcel-layer.tsx` — use `useParcelData()` instead of `getParcels()`
- Modify: `components/screen-projector.tsx` — use `useParcelData()`
- Modify: `components/globe-click-handler.tsx` — use `useParcelData()`, add draw mode early-return

- [ ] **Step 1: Update parcel-layer.tsx**

Replace `const parcels = useMemo(() => getParcels(), []);` with:
```typescript
import { useParcelData } from "@/lib/use-parcel-data";
// ...
const parcels = useParcelData();
```

**IMPORTANT: ParcelLayer overlay reactivity.** The existing `GeoJSONOverlay` is created once in a `useEffect([], ...)`. When `drawnParcels` changes, the overlay must be rebuilt. Add `parcels` to the dependency array of the overlay creation effect, and dispose/recreate the overlay when parcels change. Alternatively, update the overlay's `geojson` property and call `redraw()` in a separate `useEffect` that watches `parcels.features.length`.

- [ ] **Step 2: Update screen-projector.tsx**

Replace `const parcels = useMemo(() => getParcels(), []);` with:
```typescript
import { useParcelData } from "@/lib/use-parcel-data";
// ...
const parcels = useParcelData();
```

- [ ] **Step 3: Update globe-click-handler.tsx**

Add draw mode early-return at the top of both `handleClick` and `handleMove`:

```typescript
import { useDrawTool } from "@/lib/use-draw-tool";
// ...
const drawActive = useDrawTool((s) => s.active);
const addVertex = useDrawTool((s) => s.addVertex);

// Add pointerdown tracking for drag detection:
const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

// In handlePointerDown (new handler, add to canvas events):
pointerDownPos.current = { x: event.clientX, y: event.clientY };

// In handleClick:
if (drawActive) {
  // Ignore drags — only add vertex if pointer barely moved (< 5px)
  const down = pointerDownPos.current;
  if (down) {
    const dx = event.clientX - down.x;
    const dy = event.clientY - down.y;
    if (Math.sqrt(dx * dx + dy * dy) > 5) return; // was a drag, ignore
  }
  const result = raycastToLatLon(event, camera, gl, tiles);
  if (result) addVertex(result.lonDeg, result.latDeg);
  return;
}

// In handleMove:
if (drawActive) {
  gl.domElement.style.cursor = "crosshair";
  return;
}
```

Also replace `getParcels()` usage with `useParcelData()`.

- [ ] **Step 4: Verify TypeScript compiles and existing parcels still work**

Run: `npx tsc --noEmit`
Open viewer and click a parcel — should still show selection behavior.

- [ ] **Step 5: Commit**

```bash
git add components/parcel-layer.tsx components/screen-projector.tsx components/globe-click-handler.tsx
git commit -m "refactor: wire parcel consumers to unified data hook"
```

---

### Task 5: Build draw overlay (vertex markers + lines)

**Files:**
- Create: `components/draw-overlay.tsx`

- [ ] **Step 1: Create the R3F draw overlay component**

```typescript
"use client";

import { useDrawTool } from "@/lib/use-draw-tool";
import { useMemo } from "react";
import { Vector3 } from "three";
import { Line } from "@react-three/drei";

/**
 * Renders vertex markers and connecting lines for the active drawing.
 * Uses R3F scene objects (not HTML overlays) for smooth frame-rate tracking.
 *
 * Vertices must be in the ReorientationPlugin's local frame:
 * - Convert [lon, lat] to local meters relative to José Ignacio center
 * - X = East, Y = Up (small offset above ground), Z = -North
 */
export function DrawOverlay({ tilesRef }: { tilesRef: React.RefObject<any> }) {
  const vertices = useDrawTool((s) => s.vertices);

  // Convert lat/lon vertices to local 3D positions using tiles ellipsoid
  const positions = useMemo(() => {
    const tiles = tilesRef.current;
    if (!tiles || vertices.length === 0) return [];

    return vertices.map(([lon, lat]) => {
      const tempVec = new Vector3();
      const lonRad = (lon * Math.PI) / 180;
      const latRad = (lat * Math.PI) / 180;
      tiles.ellipsoid.getCartographicToPosition(latRad, lonRad, 50, tempVec);
      tempVec.applyMatrix4(tiles.group.matrixWorld);
      return [tempVec.x, tempVec.y, tempVec.z] as [number, number, number];
    });
  }, [vertices, tilesRef]);

  const lineGeometry = useMemo(() => {
    if (positions.length < 2) return null;
    const geo = new BufferGeometry();
    const flat = positions.flat();
    geo.setAttribute("position", new Float32BufferAttribute(flat, 3));
    return geo;
  }, [positions]);

  if (positions.length === 0) return null;

  return (
    <group>
      {/* Vertex markers */}
      {positions.map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[15, 8, 8]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}

      {/* Connecting lines — use Line from drei to avoid <line> SVG type conflict */}
      {positions.length >= 2 && (
        <Line points={positions} color="#00ffb4" lineWidth={2} />
      )}
    </group>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/draw-overlay.tsx
git commit -m "feat: add draw overlay with vertex markers and lines"
```

---

### Task 6: Build draw toolbar UI

**Files:**
- Create: `components/draw-toolbar.tsx`

- [ ] **Step 1: Create the toolbar component**

Build `components/draw-toolbar.tsx` with:
- "New Parcel" button — calls `startDrawing()`
- "Export JSON" button — calls `exportJSON()`
- When `active`: show vertex count, keyboard hints
- When polygon is just closed (vertices.length >= 3 and !active): show metadata form
- Form fields: name, priceUSD, zoning (dropdown), status (dropdown), description, contactUrl
- Submit calls `finishPolygon()` with form values
- Styled with Tailwind: fixed bar below TopBar, dark background, compact layout

Key patterns:
- Use `useDrawTool` for all state
- Listen for keyboard events (Enter → finishPolygon, Escape → cancelDrawing, Backspace → removeLastVertex) via `useEffect` with `keydown` listener
- Form defaults: zoning="Residential", status="for-sale", contactUrl="https://wa.me/..."

- [ ] **Step 2: Commit**

```bash
git add components/draw-toolbar.tsx
git commit -m "feat: add draw toolbar with metadata form"
```

---

### Task 7: Wire draw tool into MapViewer

**Files:**
- Modify: `components/map-viewer.tsx`
- Modify: `app/viewer/page.tsx` — pass `draw` search param

- [ ] **Step 1: Pass draw mode flag from page to viewer**

In `app/viewer/page.tsx`, read search params and pass to MapViewer:

```typescript
"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const MapViewer = dynamic(
  () => import("@/components/map-viewer").then((mod) => mod.MapViewer),
  { ssr: false }
);

function ViewerContent() {
  const searchParams = useSearchParams();
  const drawMode = searchParams.get("draw") === "true";
  return <MapViewer drawMode={drawMode} />;
}

export default function ViewerPage() {
  return (
    <Suspense>
      <ViewerContent />
    </Suspense>
  );
}
```

- [ ] **Step 2: Conditionally render draw components in MapViewer**

In `components/map-viewer.tsx`:
- Accept `drawMode` prop
- Conditionally render `<DrawToolbar />` and `<DrawOverlay />` when `drawMode` is true
- Import the new components

```typescript
// Inside Canvas:
{drawMode && <DrawOverlay tilesRef={tilesRef} />}

// Outside Canvas (HTML overlays area):
{drawMode && <DrawToolbar />}
```

- [ ] **Step 3: Verify draw mode works**

Open `http://localhost:3000/viewer?draw=true`
- Toolbar should appear
- Click "New Parcel" → cursor should change to crosshair
- Click on map → white sphere should appear
- Press Enter → form should appear
- Fill form + submit → parcel should render on map

- [ ] **Step 4: Commit**

```bash
git add app/viewer/page.tsx components/map-viewer.tsx
git commit -m "feat: wire draw tool into viewer with ?draw=true flag"
```

---

### Task 8: Build buyer sidebar

**Files:**
- Create: `components/parcel-sidebar.tsx`
- Modify: `components/map-viewer.tsx` — replace ParcelCard with ParcelSidebar

- [ ] **Step 1: Create the sidebar component**

Build `components/parcel-sidebar.tsx`:
- Reads `selectedParcel` from `useParcelSelection()`
- Slide-in from right, 320px wide, full height
- Dark background with backdrop blur
- Shows: name, status badge, price, area, zoning, description, contact CTA
- Close via X button or Escape key
- Mobile: full-width bottom sheet (`max-sm:w-full max-sm:h-[50vh]`)

Status badge colors:
- `for-sale`: `bg-emerald-500/20 text-emerald-400 border-emerald-500/30`
- `sold`: `bg-red-500/20 text-red-400 border-red-500/30`
- `reserved`: `bg-amber-500/20 text-amber-400 border-amber-500/30`

Animation: `transition-transform duration-300 ease-out`
- Open: `translate-x-0`
- Closed: `translate-x-full`

Use `formatPrice()` and `formatArea()` from `lib/geo-utils.ts`.

- [ ] **Step 2: Replace ParcelCard in MapViewer**

In `components/map-viewer.tsx`, replace:
```typescript
{selectedPos && <ParcelCard screenX={selectedPos.x} screenY={selectedPos.y} />}
```
with:
```typescript
<ParcelSidebar />
```

Remove the `selectedPos` dependency and the ParcelCard import.

- [ ] **Step 3: Verify sidebar works**

Click a parcel → sidebar slides in from right with parcel info.
Press Escape or X → sidebar slides out.
Check mobile viewport → should show as bottom sheet.

- [ ] **Step 4: Commit**

```bash
git add components/parcel-sidebar.tsx components/map-viewer.tsx
git commit -m "feat: add buyer sidebar replacing floating parcel card"
```

---

### Task 9: Clean up unused files

**Files:**
- Remove: `components/parcel-card.tsx` (replaced by sidebar)
- Modify: `components/map-viewer.tsx` — remove unused imports

- [ ] **Step 1: Remove ParcelCard**

Delete `components/parcel-card.tsx`.
Remove any remaining imports of `ParcelCard` from `map-viewer.tsx`.
Remove `selectedPos` from the `Overlays` component if no longer needed.

- [ ] **Step 2: Verify TypeScript compiles and app works**

Run: `npx tsc --noEmit`
Open viewer — parcels clickable, sidebar works, draw mode works.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove replaced ParcelCard component"
```
