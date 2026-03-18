# El Pela Parcel Viewer — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a premium 3D parcel viewer showing Google Photorealistic 3D Tiles of José Ignacio, Uruguay with 5 interactive parcel polygons, floating detail cards, and procedural clouds.

**Architecture:** Next.js 15 App Router with React Three Fiber rendering Google 3D Tiles via 3DTilesRendererJS. Parcel polygons rendered as GeoJSON overlays on tiles. HTML overlays for floating cards/pills positioned via 3D-to-screen projection. Procedural GLSL cloud shader on a hemisphere mesh.

**Tech Stack:** Next.js 15, React Three Fiber (`@react-three/fiber`), `3d-tiles-renderer`, Tailwind CSS 4, TypeScript.

---

## Chunk 1: Project Scaffolding

### Task 1: Initialize Next.js Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `tailwind.config.ts`
- Create: `app/globals.css`
- Create: `.env.local`
- Create: `.gitignore`

- [ ] **Step 1: Create Next.js project**

Run:
```bash
cd /Users/anibalin/Sites/2026/elpela2
npx create-next-app@latest . --typescript --tailwind --eslint --app --src=no --import-alias "@/*" --use-npm
```

Expected: Project scaffolded with App Router structure.

- [ ] **Step 2: Install 3D dependencies**

Run:
```bash
npm install three @react-three/fiber @react-three/drei 3d-tiles-renderer
npm install -D @types/three
```

- [ ] **Step 3: Create .env.local with placeholder API key**

Create `.env.local`:
```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_API_KEY_HERE
```

- [ ] **Step 4: Configure next.config.ts for Three.js**

Replace `next.config.ts`:
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["three", "3d-tiles-renderer"],
};

export default nextConfig;
```

- [ ] **Step 5: Set up dark background in globals.css**

Add to `app/globals.css` after the Tailwind imports:
```css
html,
body {
  height: 100%;
  margin: 0;
  overflow: hidden;
  background: #0a0a0a;
}
```

- [ ] **Step 6: Initialize git repo and commit**

Run:
```bash
cd /Users/anibalin/Sites/2026/elpela2
git init
echo ".superpowers/" >> .gitignore
git add -A
git commit -m "chore: initialize Next.js project with 3D dependencies"
```

---

### Task 2: Root Layout and Landing Page

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`
- Create: `app/viewer/page.tsx`

- [ ] **Step 1: Update root layout with meta tags**

Replace `app/layout.tsx`:
```typescript
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "El Pela — José Ignacio Real Estate",
  description:
    "Explore premium land parcels in José Ignacio, Uruguay in immersive 3D.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Create landing page that redirects to viewer**

Replace `app/page.tsx`:
```typescript
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/viewer");
}
```

- [ ] **Step 3: Create viewer page with placeholder**

Create `app/viewer/page.tsx`:
```typescript
export default function ViewerPage() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#0a0a0a] text-white/50 text-sm">
      Loading viewer...
    </div>
  );
}
```

- [ ] **Step 4: Verify the app runs**

Run:
```bash
npm run dev
```

Open http://localhost:3000. Expected: redirects to /viewer, shows "Loading viewer..." on dark background.

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx app/page.tsx app/viewer/page.tsx
git commit -m "feat: add root layout and viewer page shell"
```

---

## Chunk 2: 3D Globe with Google Tiles

### Task 3: Geo Utilities and Constants

**Files:**
- Create: `lib/constants.ts`
- Create: `lib/geo-utils.ts`
- Create: `lib/geo-utils.test.ts`

- [ ] **Step 1: Write geo-utils test**

Create `lib/geo-utils.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { centroid, degToRad, formatPrice, formatArea } from "./geo-utils";

describe("degToRad", () => {
  it("converts 180 degrees to PI", () => {
    expect(degToRad(180)).toBeCloseTo(Math.PI);
  });
});

describe("centroid", () => {
  it("computes centroid of a square polygon", () => {
    const coords: [number, number][] = [
      [-54.634, -34.805],
      [-54.632, -34.805],
      [-54.632, -34.807],
      [-54.634, -34.807],
      [-54.634, -34.805],
    ];
    const [lon, lat] = centroid(coords);
    expect(lon).toBeCloseTo(-54.633);
    expect(lat).toBeCloseTo(-34.806);
  });
});

describe("formatPrice", () => {
  it("formats 450000 as USD 450,000", () => {
    expect(formatPrice(450000)).toBe("USD 450,000");
  });
});

describe("formatArea", () => {
  it("formats 2500 as 2,500 m²", () => {
    expect(formatArea(2500)).toBe("2,500 m²");
  });
});
```

- [ ] **Step 2: Install vitest, create config, and run test to verify it fails**

```bash
npm install -D vitest
```

Create `vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

Run:
```bash
npx vitest run lib/geo-utils.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create constants**

Create `lib/constants.ts`:
```typescript
/** José Ignacio lighthouse — center of the viewing area */
export const JOSE_IGNACIO_CENTER = {
  lat: -34.7925,
  lon: -54.6335,
} as const;

/** Initial camera position — looking at José Ignacio from above */
export const INITIAL_CAMERA_POSITION: [number, number, number] = [
  0, 0.5e7, 1.5e7,
];

/** Parcel polygon default colors */
export const PARCEL_COLORS = {
  fill: "rgba(0, 200, 255, 0.15)",
  fillHover: "rgba(0, 200, 255, 0.3)",
  fillSelected: "rgba(0, 200, 255, 0.4)",
  stroke: "rgba(0, 255, 180, 0.6)",
  strokeHover: "rgba(0, 255, 180, 0.9)",
  strokeSelected: "rgba(0, 200, 255, 1)",
  strokeWidth: 2,
  strokeWidthSelected: 4,
} as const;
```

- [ ] **Step 4: Create geo-utils**

Create `lib/geo-utils.ts`:
```typescript
/**
 * Convert degrees to radians.
 */
export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Compute the centroid of a GeoJSON polygon ring.
 * Excludes the closing duplicate vertex.
 * Returns [lon, lat].
 */
export function centroid(ring: [number, number][]): [number, number] {
  // Exclude the closing vertex (same as first)
  const vertices = ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1]
    ? ring.slice(0, -1)
    : ring;

  let lonSum = 0;
  let latSum = 0;
  for (const [lon, lat] of vertices) {
    lonSum += lon;
    latSum += lat;
  }
  return [lonSum / vertices.length, latSum / vertices.length];
}

/**
 * Format a USD price with comma separators.
 */
export function formatPrice(usd: number): string {
  return `USD ${usd.toLocaleString("en-US")}`;
}

/**
 * Format area in square meters with comma separators.
 */
export function formatArea(sqm: number): string {
  return `${sqm.toLocaleString("en-US")} m²`;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run lib/geo-utils.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/ vitest.config.ts package.json package-lock.json
git commit -m "feat: add geo utilities and constants"
```

---

### Task 4: Parcel Data Types and Mock GeoJSON

**Files:**
- Create: `lib/parcels.ts`
- Create: `data/parcels.geojson`

- [ ] **Step 1: Create parcel types and loader**

Create `lib/parcels.ts`:
```typescript
import type { FeatureCollection, Feature, Polygon } from "geojson";
import parcelsData from "@/data/parcels.geojson";

export interface ParcelProperties {
  id: string;
  name: string;
  areaSqMeters: number;
  priceUSD: number;
  zoning: string;
  description?: string;
  contactUrl: string;
  color?: string;
}

export type ParcelFeature = Feature<Polygon, ParcelProperties>;
export type ParcelCollection = FeatureCollection<Polygon, ParcelProperties>;

export function getParcels(): ParcelCollection {
  return parcelsData as ParcelCollection;
}
```

- [ ] **Step 2: Create mock GeoJSON data**

Create `data/parcels.geojson`:
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "id": "marina-vista",
        "name": "Marina Vista",
        "areaSqMeters": 2500,
        "priceUSD": 450000,
        "zoning": "Residential",
        "description": "Premium lot with ocean views near the iconic lighthouse.",
        "contactUrl": "https://wa.me/598XXXXXXXX?text=Interested%20in%20Marina%20Vista"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-54.6350, -34.7920],
          [-54.6330, -34.7920],
          [-54.6328, -34.7935],
          [-54.6348, -34.7937],
          [-54.6350, -34.7920]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "id": "playa-brava",
        "name": "Playa Brava",
        "areaSqMeters": 1800,
        "priceUSD": 320000,
        "zoning": "Residential",
        "description": "Steps from the surf break, ideal for beach lovers.",
        "contactUrl": "https://wa.me/598XXXXXXXX?text=Interested%20in%20Playa%20Brava"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-54.6295, -34.7885],
          [-54.6275, -34.7883],
          [-54.6273, -34.7898],
          [-54.6293, -34.7900],
          [-54.6295, -34.7885]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "id": "laguna-norte",
        "name": "Laguna Norte",
        "areaSqMeters": 3200,
        "priceUSD": 580000,
        "zoning": "Mixed Use",
        "description": "Expansive parcel overlooking the lagoon, zoned for hospitality.",
        "contactUrl": "https://wa.me/598XXXXXXXX?text=Interested%20in%20Laguna%20Norte"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-54.6420, -34.7825],
          [-54.6395, -34.7822],
          [-54.6390, -34.7842],
          [-54.6415, -34.7845],
          [-54.6420, -34.7825]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "id": "faro-este",
        "name": "Faro Este",
        "areaSqMeters": 2100,
        "priceUSD": 390000,
        "zoning": "Residential",
        "description": "Quiet eastern lot with lighthouse views and morning sun.",
        "contactUrl": "https://wa.me/598XXXXXXXX?text=Interested%20in%20Faro%20Este"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-54.6315, -34.7935],
          [-54.6298, -34.7933],
          [-54.6296, -34.7948],
          [-54.6313, -34.7950],
          [-54.6315, -34.7935]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "id": "el-bosque",
        "name": "El Bosque",
        "areaSqMeters": 4500,
        "priceUSD": 420000,
        "zoning": "Rural Residential",
        "description": "Wooded retreat set back from the coast with complete privacy.",
        "contactUrl": "https://wa.me/598XXXXXXXX?text=Interested%20in%20El%20Bosque"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-54.6470, -34.7865],
          [-54.6445, -34.7860],
          [-54.6440, -34.7885],
          [-54.6465, -34.7890],
          [-54.6470, -34.7865]
        ]]
      }
    }
  ]
}
```

- [ ] **Step 3: Add GeoJSON type declaration and verify JSON imports**

Create `types/geojson.d.ts`:
```typescript
declare module "*.geojson" {
  const value: any;
  export default value;
}
```

Verify `tsconfig.json` has `resolveJsonModule: true` and `esModuleInterop: true` (should be set from create-next-app). Also ensure `"include"` covers `"types/**/*.ts"`.

- [ ] **Step 4: Commit**

```bash
git add lib/parcels.ts data/parcels.geojson types/geojson.d.ts tsconfig.json
git commit -m "feat: add parcel types and mock GeoJSON data for 5 José Ignacio parcels"
```

---

### Task 5: Google Tiles Layer Component

**Files:**
- Create: `components/google-tiles-layer.tsx`

- [ ] **Step 1: Create the Google Tiles layer**

Create `components/google-tiles-layer.tsx`:
```typescript
"use client";

import { TilesRenderer, TilesPlugin, GlobeControls, TilesAttributionOverlay, CompassGizmo } from "3d-tiles-renderer/r3f";
import { GoogleCloudAuthPlugin, TilesFadePlugin, UpdateOnChangePlugin, TileCompressionPlugin } from "3d-tiles-renderer/plugins";

interface GoogleTilesLayerProps {
  apiToken: string;
  children?: React.ReactNode;
}

export function GoogleTilesLayer({ apiToken, children }: GoogleTilesLayerProps) {
  return (
    <TilesRenderer group={{ rotation: [-Math.PI / 2, 0, 0] }}>
      <TilesPlugin plugin={GoogleCloudAuthPlugin} args={{ apiToken }} />
      <TilesPlugin plugin={TilesFadePlugin} fadeDuration={300} />
      <TilesPlugin plugin={UpdateOnChangePlugin} />
      <TilesPlugin plugin={TileCompressionPlugin} />

      <GlobeControls enableDamping />

      <TilesAttributionOverlay />
      <CompassGizmo />

      {children}
    </TilesRenderer>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/google-tiles-layer.tsx
git commit -m "feat: add Google Photorealistic 3D Tiles layer component"
```

---

### Task 6: Map Viewer with R3F Canvas

**Files:**
- Create: `components/map-viewer.tsx`
- Modify: `app/viewer/page.tsx`

- [ ] **Step 1: Create the MapViewer component**

Create `components/map-viewer.tsx`:
```typescript
"use client";

import { Canvas } from "@react-three/fiber";
import { GoogleTilesLayer } from "./google-tiles-layer";
import { INITIAL_CAMERA_POSITION } from "@/lib/constants";

export function MapViewer() {
  const apiToken = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiToken || apiToken === "YOUR_API_KEY_HERE") {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a] text-white/50 text-sm">
        Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local
      </div>
    );
  }

  return (
    <div className="h-screen w-screen">
      <Canvas
        camera={{ position: INITIAL_CAMERA_POSITION }}
        flat
        frameloop="demand"
      >
        <color attach="background" args={[0x111111]} />
        <ambientLight intensity={1} />
        <GoogleTilesLayer apiToken={apiToken} />
      </Canvas>
    </div>
  );
}
```

- [ ] **Step 2: Update viewer page with dynamic import**

Replace `app/viewer/page.tsx`:
```typescript
import dynamic from "next/dynamic";

const MapViewer = dynamic(
  () => import("@/components/map-viewer").then((mod) => mod.MapViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a] text-white/50 text-sm">
        Loading 3D viewer...
      </div>
    ),
  }
);

export default function ViewerPage() {
  return <MapViewer />;
}
```

- [ ] **Step 3: Add the Google API key and test**

Update `.env.local` with the real API key (get from client). Then run:
```bash
npm run dev
```

Open http://localhost:3000. Expected: Google Photorealistic 3D globe renders. You can orbit, zoom, and pan. The globe shows Earth with photorealistic imagery.

- [ ] **Step 4: Commit**

```bash
git add components/map-viewer.tsx app/viewer/page.tsx
git commit -m "feat: add 3D globe viewer with Google Photorealistic Tiles"
```

---

## Chunk 3: Parcel Polygons & Interaction

### Task 7: GeoJSON Parcel Overlay

**Files:**
- Create: `components/parcel-layer.tsx`

The `3d-tiles-renderer` library provides `ImageOverlayPlugin` and `GeoJSONOverlay` to paint polygons onto the tile surfaces. We need a small R3F wrapper since the library doesn't export a ready-made R3F component for overlays.

- [ ] **Step 1: Create parcel layer with GeoJSON overlay**

Create `components/parcel-layer.tsx`:
```typescript
"use client";

import { useContext, useEffect, useMemo, useRef, forwardRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { TilesPlugin } from "3d-tiles-renderer/r3f";
import { ImageOverlayPlugin, GeoJSONOverlay } from "3d-tiles-renderer/plugins";
import { getParcels } from "@/lib/parcels";
import { PARCEL_COLORS } from "@/lib/constants";

export function ParcelLayer() {
  const gl = useThree((state) => state.gl);
  const parcels = useMemo(() => getParcels(), []);
  const pluginRef = useRef<InstanceType<typeof ImageOverlayPlugin> | null>(null);
  const overlayRef = useRef<InstanceType<typeof GeoJSONOverlay> | null>(null);

  useEffect(() => {
    const plugin = pluginRef.current;
    if (!plugin) return;

    const overlay = new GeoJSONOverlay({
      geojson: parcels,
      fillStyle: PARCEL_COLORS.fill,
      strokeStyle: PARCEL_COLORS.stroke,
      strokeWidth: PARCEL_COLORS.strokeWidth,
    });

    plugin.addOverlay(overlay);
    overlayRef.current = overlay;

    return () => {
      plugin.deleteOverlay(overlay);
    };
  }, [parcels]);

  return (
    <TilesPlugin
      plugin={ImageOverlayPlugin}
      args={{ renderer: gl }}
      ref={pluginRef}
    />
  );
}
```

- [ ] **Step 2: Add ParcelLayer to MapViewer**

Modify `components/map-viewer.tsx` — add `<ParcelLayer />` as a child of `<GoogleTilesLayer>`:

```typescript
import { ParcelLayer } from "./parcel-layer";

// Inside the GoogleTilesLayer:
<GoogleTilesLayer apiToken={apiToken}>
  <ParcelLayer />
</GoogleTilesLayer>
```

- [ ] **Step 3: Test the parcel polygons**

Run `npm run dev`, navigate to José Ignacio (lat: -34.79, lon: -54.63). Expected: 5 colored polygon overlays visible on the terrain near the lighthouse and surrounding areas.

- [ ] **Step 4: Commit**

```bash
git add components/parcel-layer.tsx components/map-viewer.tsx
git commit -m "feat: render parcel polygons as GeoJSON overlay on 3D tiles"
```

---

### Task 8: Parcel Selection State

**Files:**
- Create: `lib/use-parcel-selection.ts`

- [ ] **Step 1: Create parcel selection hook**

Create `lib/use-parcel-selection.ts`:
```typescript
import { create } from "zustand";
import type { ParcelProperties } from "./parcels";

interface ParcelSelectionState {
  selectedId: string | null;
  hoveredId: string | null;
  selectedParcel: ParcelProperties | null;
  select: (parcel: ParcelProperties | null) => void;
  hover: (id: string | null) => void;
}

export const useParcelSelection = create<ParcelSelectionState>((set) => ({
  selectedId: null,
  hoveredId: null,
  selectedParcel: null,
  select: (parcel) =>
    set({
      selectedId: parcel?.id ?? null,
      selectedParcel: parcel ?? null,
    }),
  hover: (id) => set({ hoveredId: id }),
}));
```

- [ ] **Step 2: Install zustand**

```bash
npm install zustand
```

- [ ] **Step 3: Commit**

```bash
git add lib/use-parcel-selection.ts package.json package-lock.json
git commit -m "feat: add parcel selection state with zustand"
```

---

### Task 9: Click Detection on Globe

**Files:**
- Modify: `components/map-viewer.tsx`
- Create: `lib/point-in-polygon.ts`

We need to detect clicks on the globe, convert the hit point to lat/lon, then check which parcel polygon contains that point.

- [ ] **Step 1: Write point-in-polygon test**

Create `lib/point-in-polygon.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { pointInPolygon } from "./point-in-polygon";

describe("pointInPolygon", () => {
  const square: [number, number][] = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
    [0, 0],
  ];

  it("returns true for a point inside", () => {
    expect(pointInPolygon([5, 5], square)).toBe(true);
  });

  it("returns false for a point outside", () => {
    expect(pointInPolygon([15, 5], square)).toBe(false);
  });

  it("returns false for a point far outside", () => {
    expect(pointInPolygon([-5, -5], square)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run lib/point-in-polygon.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement point-in-polygon (ray casting algorithm)**

Create `lib/point-in-polygon.ts`:
```typescript
/**
 * Ray casting algorithm to determine if a point is inside a polygon.
 * Works with GeoJSON coordinate rings ([lon, lat] pairs).
 */
export function pointInPolygon(
  point: [number, number],
  ring: [number, number][]
): boolean {
  const [px, py] = point;
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];

    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run lib/point-in-polygon.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Create globe click handler**

Create `components/globe-click-handler.tsx`:
```typescript
"use client";

import { useCallback, useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Raycaster, Vector2 } from "three";
import { getParcels } from "@/lib/parcels";
import { useParcelSelection } from "@/lib/use-parcel-selection";
import { pointInPolygon } from "@/lib/point-in-polygon";

interface GlobeClickHandlerProps {
  tilesRef: React.RefObject<any>;
}

export function GlobeClickHandler({ tilesRef }: GlobeClickHandlerProps) {
  const { camera, gl } = useThree();
  const parcels = getParcels();
  const { select } = useParcelSelection();

  const handleClick = useCallback(
    (event: PointerEvent) => {
      const tiles = tilesRef.current;
      if (!tiles) return;

      const raycaster = new Raycaster();
      const mouse = new Vector2();
      const rect = gl.domElement.getBoundingClientRect();

      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(tiles.group, true);

      if (intersects.length > 0) {
        const hit = intersects[0];
        const latLon: { lat: number; lon: number } = { lat: 0, lon: 0 };
        tiles.ellipsoid.getPositionToCartographic(hit.point, latLon);

        const lonDeg = (latLon.lon * 180) / Math.PI;
        const latDeg = (latLon.lat * 180) / Math.PI;

        // Check which parcel contains this point
        for (const feature of parcels.features) {
          const ring = feature.geometry.coordinates[0] as [number, number][];
          if (pointInPolygon([lonDeg, latDeg], ring)) {
            select(feature.properties);
            return;
          }
        }
      }

      // Clicked outside any parcel — deselect
      select(null);
    },
    [camera, gl, tilesRef, parcels, select]
  );

  // Attach pointer event to canvas with proper cleanup
  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener("pointerup", handleClick);
    return () => {
      canvas.removeEventListener("pointerup", handleClick);
    };
  }, [gl, handleClick]);

  return null;
}
```

- [ ] **Step 6: Wire up click handler in MapViewer**

Update `components/map-viewer.tsx` to pass a ref to TilesRenderer and include the click handler:

```typescript
import { useRef } from "react";
import { GlobeClickHandler } from "./globe-click-handler";

// Inside MapViewer component:
const tilesRef = useRef(null);

// Update GoogleTilesLayer to accept and forward ref
// Add GlobeClickHandler as a sibling inside Canvas:
<GlobeClickHandler tilesRef={tilesRef} />
```

Replace `components/google-tiles-layer.tsx` entirely:
```typescript
"use client";

import { forwardRef } from "react";
import { TilesRenderer, TilesPlugin, GlobeControls, TilesAttributionOverlay, CompassGizmo } from "3d-tiles-renderer/r3f";
import { GoogleCloudAuthPlugin, TilesFadePlugin, UpdateOnChangePlugin, TileCompressionPlugin } from "3d-tiles-renderer/plugins";

interface GoogleTilesLayerProps {
  apiToken: string;
  children?: React.ReactNode;
}

export const GoogleTilesLayer = forwardRef<any, GoogleTilesLayerProps>(
  function GoogleTilesLayer({ apiToken, children }, ref) {
    return (
      <TilesRenderer ref={ref} group={{ rotation: [-Math.PI / 2, 0, 0] }}>
        <TilesPlugin plugin={GoogleCloudAuthPlugin} args={{ apiToken }} />
        <TilesPlugin plugin={TilesFadePlugin} fadeDuration={300} />
        <TilesPlugin plugin={UpdateOnChangePlugin} />
        <TilesPlugin plugin={TileCompressionPlugin} />

        <GlobeControls enableDamping />

        <TilesAttributionOverlay />
        <CompassGizmo />

        {children}
      </TilesRenderer>
    );
  }
);
```

- [ ] **Step 7: Commit**

```bash
git add lib/point-in-polygon.ts lib/point-in-polygon.test.ts components/globe-click-handler.tsx components/map-viewer.tsx components/google-tiles-layer.tsx
git commit -m "feat: add globe click detection with point-in-polygon parcel matching"
```

### Task 9b: Hover State Detection

**Files:**
- Modify: `components/globe-click-handler.tsx`

- [ ] **Step 1: Add pointermove handler for hover detection**

Update `components/globe-click-handler.tsx` — add a `pointermove` listener alongside the `pointerup` one:

```typescript
const { hover } = useParcelSelection();

const handleMove = useCallback(
  (event: PointerEvent) => {
    const tiles = tilesRef.current;
    if (!tiles) return;

    const raycaster = new Raycaster();
    const mouse = new Vector2();
    const rect = gl.domElement.getBoundingClientRect();

    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(tiles.group, true);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const latLon: { lat: number; lon: number } = { lat: 0, lon: 0 };
      tiles.ellipsoid.getPositionToCartographic(hit.point, latLon);
      const lonDeg = (latLon.lon * 180) / Math.PI;
      const latDeg = (latLon.lat * 180) / Math.PI;

      for (const feature of parcels.features) {
        const ring = feature.geometry.coordinates[0] as [number, number][];
        if (pointInPolygon([lonDeg, latDeg], ring)) {
          hover(feature.properties.id);
          gl.domElement.style.cursor = "pointer";
          return;
        }
      }
    }

    hover(null);
    gl.domElement.style.cursor = "grab";
  },
  [camera, gl, tilesRef, parcels, hover]
);

// In the useEffect, add both listeners:
useEffect(() => {
  const canvas = gl.domElement;
  canvas.addEventListener("pointerup", handleClick);
  canvas.addEventListener("pointermove", handleMove);
  return () => {
    canvas.removeEventListener("pointerup", handleClick);
    canvas.removeEventListener("pointermove", handleMove);
  };
}, [gl, handleClick, handleMove]);
```

- [ ] **Step 2: Commit**

```bash
git add components/globe-click-handler.tsx
git commit -m "feat: add parcel hover detection with cursor change"
```

---

## Chunk 4: UI Overlays

### Task 10: Top Bar

**Files:**
- Create: `components/top-bar.tsx`
- Modify: `components/map-viewer.tsx`

- [ ] **Step 1: Create TopBar component**

Create `components/top-bar.tsx`:
```typescript
interface TopBarProps {
  parcelCount: number;
}

export function TopBar({ parcelCount }: TopBarProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent px-5 py-4">
      <div className="flex items-baseline gap-2">
        <span className="text-base font-bold tracking-wide text-white">
          El Pela
        </span>
        <span className="text-[11px] text-white/40">
          José Ignacio, Uruguay
        </span>
      </div>
      <div className="rounded-md border border-white/12 px-3 py-1 text-[11px] text-white/50">
        {parcelCount} Parcels
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add TopBar to MapViewer**

Add to `components/map-viewer.tsx`, outside the Canvas but inside the wrapper div:
```typescript
import { TopBar } from "./top-bar";
import { getParcels } from "@/lib/parcels";

// Inside MapViewer, before <Canvas>:
const parcels = useMemo(() => getParcels(), []);

// After <Canvas>, inside the wrapper div:
<TopBar parcelCount={parcels.features.length} />
```

- [ ] **Step 3: Test visually**

Run `npm run dev`. Expected: "El Pela" brand bar at top with gradient fade, "5 Parcels" badge on right.

- [ ] **Step 4: Commit**

```bash
git add components/top-bar.tsx components/map-viewer.tsx
git commit -m "feat: add top bar with branding and parcel count"
```

---

### Task 11: Parcel Pill Labels

**Files:**
- Create: `components/parcel-pills.tsx`

The pills are HTML elements positioned on screen by projecting 3D world coordinates to 2D. We use R3F's `useFrame` to update positions each frame.

- [ ] **Step 1: Create ParcelPills component**

Create `components/parcel-pills.tsx`:
```typescript
"use client";

import { useRef, useMemo, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { getParcels } from "@/lib/parcels";
import { centroid, degToRad } from "@/lib/geo-utils";
import { useParcelSelection } from "@/lib/use-parcel-selection";

interface PillPosition {
  id: string;
  name: string;
  x: number;
  y: number;
  visible: boolean;
}

interface ParcelPillsOverlayProps {
  positions: PillPosition[];
}

/**
 * HTML overlay that renders pill labels.
 * This component lives OUTSIDE the Canvas.
 */
export function ParcelPillsOverlay({ positions }: ParcelPillsOverlayProps) {
  const selectedId = useParcelSelection((s) => s.selectedId);

  return (
    <div className="pointer-events-none fixed inset-0 z-10">
      {positions.map((pill) =>
        pill.visible ? (
          <div
            key={pill.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: pill.x, top: pill.y }}
          >
            <div
              className={`
                rounded-[10px] border px-2.5 py-0.5 text-[10px] backdrop-blur-sm
                transition-all duration-200
                ${
                  pill.id === selectedId
                    ? "border-cyan-400/40 bg-cyan-950/70 text-cyan-300"
                    : "border-white/8 bg-[rgba(30,30,30,0.7)] text-white/60"
                }
              `}
            >
              {pill.name}
            </div>
          </div>
        ) : null
      )}
    </div>
  );
}
```

Note: The 3D-to-screen projection needs to happen inside R3F's render loop. We'll compute pill positions inside the Canvas via a bridge component and pass them out via a callback. This will be wired in Task 13 (final wiring).

- [ ] **Step 2: Commit**

```bash
git add components/parcel-pills.tsx
git commit -m "feat: add floating parcel pill label overlay"
```

---

### Task 12: Parcel Detail Card

**Files:**
- Create: `components/parcel-card.tsx`

- [ ] **Step 1: Create ParcelCard component**

Create `components/parcel-card.tsx`:
```typescript
"use client";

import { useParcelSelection } from "@/lib/use-parcel-selection";
import { formatPrice, formatArea } from "@/lib/geo-utils";

interface ParcelCardProps {
  screenX: number;
  screenY: number;
}

export function ParcelCard({ screenX, screenY }: ParcelCardProps) {
  const { selectedParcel, select } = useParcelSelection();

  if (!selectedParcel) return null;

  return (
    <div
      className="fixed z-20 w-[220px] max-w-[90vw] -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 duration-200 max-sm:bottom-4 max-sm:left-1/2 max-sm:top-auto"
      style={{
        left: screenX,
        top: Math.max(screenY - 20, 80),
      }}
    >
      <div className="rounded-xl border border-black/8 bg-[rgba(240,240,240,0.95)] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
        {/* Header */}
        <div className="text-[10px] font-medium uppercase tracking-[1.5px] text-black/40">
          Selected Parcel
        </div>
        <div className="mt-1.5 text-base font-bold leading-tight text-[#111]">
          {selectedParcel.name}
        </div>

        {/* Description */}
        {selectedParcel.description && (
          <p className="mt-2 text-[11px] leading-relaxed text-black/50">
            {selectedParcel.description}
          </p>
        )}

        {/* Stats */}
        <div className="mt-3 flex gap-4">
          <div>
            <div className="text-[9px] uppercase tracking-[0.5px] text-black/40">
              Area
            </div>
            <div className="text-[13px] font-semibold text-[#222]">
              {formatArea(selectedParcel.areaSqMeters)}
            </div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-[0.5px] text-black/40">
              Zoning
            </div>
            <div className="text-[13px] font-semibold text-[#222]">
              {selectedParcel.zoning}
            </div>
          </div>
        </div>

        {/* Price */}
        <div className="mt-3 border-t border-black/8 pt-3">
          <div className="text-[9px] uppercase tracking-[0.5px] text-black/40">
            Price
          </div>
          <div className="text-lg font-bold text-[#111]">
            {formatPrice(selectedParcel.priceUSD)}
          </div>
        </div>

        {/* CTA */}
        <a
          href={selectedParcel.contactUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block rounded-md bg-[#111] py-2 text-center text-xs font-medium text-white transition-colors hover:bg-[#333]"
        >
          Contact Agent
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/parcel-card.tsx
git commit -m "feat: add floating parcel detail card with glassmorphism design"
```

---

### Task 13: Wire Up Overlays with 3D Projection

**Files:**
- Create: `components/screen-projector.tsx`
- Modify: `components/map-viewer.tsx`

This is the bridge between the R3F world (3D coordinates) and the HTML overlays (screen coordinates). A component inside the Canvas computes screen positions each frame and passes them out via a callback.

- [ ] **Step 1: Create the screen projector**

Create `components/screen-projector.tsx`:
```typescript
"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { getParcels } from "@/lib/parcels";
import { centroid, degToRad } from "@/lib/geo-utils";
import { useParcelSelection } from "@/lib/use-parcel-selection";

export interface ScreenPosition {
  id: string;
  name: string;
  x: number;
  y: number;
  visible: boolean;
}

interface ScreenProjectorProps {
  tilesRef: React.RefObject<any>;
  onUpdate: (pills: ScreenPosition[], selectedPos: { x: number; y: number } | null) => void;
}

export function ScreenProjector({ tilesRef, onUpdate }: ScreenProjectorProps) {
  const { camera, size } = useThree();
  const parcels = useMemo(() => getParcels(), []);
  const selectedId = useParcelSelection((s) => s.selectedId);
  const tempVec = useMemo(() => new Vector3(), []);
  const lastUpdate = useRef(0);

  // Precompute centroids in radians
  const parcelCentroids = useMemo(() => {
    return parcels.features.map((f) => {
      const ring = f.geometry.coordinates[0] as [number, number][];
      const [lon, lat] = centroid(ring);
      return {
        id: f.properties.id,
        name: f.properties.name,
        latRad: degToRad(lat),
        lonRad: degToRad(lon),
      };
    });
  }, [parcels]);

  useFrame((state) => {
    // Throttle to ~30fps to avoid excessive React state updates
    const now = state.clock.elapsedTime;
    if (now - lastUpdate.current < 0.033) return;
    lastUpdate.current = now;

    const tiles = tilesRef.current;
    if (!tiles || !tiles.ellipsoid) return;

    const positions: ScreenPosition[] = [];
    let selectedPos: { x: number; y: number } | null = null;

    for (const pc of parcelCentroids) {
      // Convert lat/lon to ECEF position
      tiles.ellipsoid.getCartographicToPosition(
        pc.latRad,
        pc.lonRad,
        50, // height above ellipsoid in meters
        tempVec
      );

      // Apply the tiles group transform (Z-up to Y-up rotation)
      tempVec.applyMatrix4(tiles.group.matrixWorld);

      // Project to screen
      const projected = tempVec.clone().project(camera);
      const x = (projected.x * 0.5 + 0.5) * size.width;
      const y = (-projected.y * 0.5 + 0.5) * size.height;
      const visible = projected.z < 1 && x > -50 && x < size.width + 50 && y > -50 && y < size.height + 50;

      positions.push({ id: pc.id, name: pc.name, x, y, visible });

      if (pc.id === selectedId) {
        selectedPos = { x, y };
      }
    }

    onUpdate(positions, selectedPos);
  });

  return null;
}
```

- [ ] **Step 2: Update MapViewer to wire everything together**

Replace `components/map-viewer.tsx`:
```typescript
"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { GoogleTilesLayer } from "./google-tiles-layer";
import { ParcelLayer } from "./parcel-layer";
import { GlobeClickHandler } from "./globe-click-handler";
import { ScreenProjector, type ScreenPosition } from "./screen-projector";
import { ParcelPillsOverlay } from "./parcel-pills";
import { ParcelCard } from "./parcel-card";
import { TopBar } from "./top-bar";
import { getParcels } from "@/lib/parcels";
import { INITIAL_CAMERA_POSITION } from "@/lib/constants";

export function MapViewer() {
  const apiToken = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const tilesRef = useRef<any>(null);
  const parcels = useMemo(() => getParcels(), []);

  const [pillPositions, setPillPositions] = useState<ScreenPosition[]>([]);
  const [selectedScreenPos, setSelectedScreenPos] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const handleProjectionUpdate = useCallback(
    (pills: ScreenPosition[], selPos: { x: number; y: number } | null) => {
      setPillPositions(pills);
      setSelectedScreenPos(selPos);
    },
    []
  );

  if (!apiToken || apiToken === "YOUR_API_KEY_HERE") {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a] text-sm text-white/50">
        Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen">
      <Canvas
        camera={{ position: INITIAL_CAMERA_POSITION }}
        flat
        frameloop="demand"
      >
        <color attach="background" args={[0x111111]} />
        <ambientLight intensity={1} />

        <GoogleTilesLayer ref={tilesRef} apiToken={apiToken}>
          <ParcelLayer />
        </GoogleTilesLayer>

        <GlobeClickHandler tilesRef={tilesRef} />
        <ScreenProjector
          tilesRef={tilesRef}
          onUpdate={handleProjectionUpdate}
        />
      </Canvas>

      {/* HTML Overlays */}
      <TopBar parcelCount={parcels.features.length} />
      <ParcelPillsOverlay positions={pillPositions} />
      {selectedScreenPos && (
        <ParcelCard
          screenX={selectedScreenPos.x}
          screenY={selectedScreenPos.y}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Test the full interaction flow**

Run `npm run dev`. Navigate to José Ignacio. Expected:
1. Parcel polygons visible on terrain
2. Pill labels floating above each parcel
3. Click a parcel → grey detail card appears with name, area, price, zoning
4. Click "Contact Agent" → opens WhatsApp link
5. Click elsewhere → card dismisses

- [ ] **Step 4: Commit**

```bash
git add components/screen-projector.tsx components/map-viewer.tsx
git commit -m "feat: wire up 3D-to-screen projection for parcel pills and detail card"
```

---

## Chunk 5: Clouds & Final Polish

### Task 14: Procedural Cloud Shader

**Files:**
- Create: `shaders/clouds.ts`
- Create: `components/cloud-layer.tsx`

- [ ] **Step 1: Create cloud shader GLSL**

Create `shaders/clouds.ts`:
```typescript
export const cloudVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const cloudFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vWorldPosition;

  // Simplex-style noise
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
      value += amplitude * snoise(p);
      p *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    // Fade at edges of hemisphere
    float edgeFade = smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
    float sideFade = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x);

    // Animated cloud noise
    vec3 noiseCoord = vec3(vUv * 3.0, uTime * 0.02);
    noiseCoord.x += uTime * 0.01; // wind drift

    float noise = fbm(noiseCoord);
    float cloud = smoothstep(0.1, 0.6, noise);

    // Warm golden tint
    vec3 cloudColor = mix(
      vec3(0.85, 0.82, 0.78),  // warm grey
      vec3(1.0, 0.95, 0.88),   // golden white
      cloud
    );

    float alpha = cloud * edgeFade * sideFade * uOpacity;
    gl_FragColor = vec4(cloudColor, alpha);
  }
`;
```

- [ ] **Step 2: Create CloudLayer component**

Create `components/cloud-layer.tsx`:
```typescript
"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { ShaderMaterial, DoubleSide } from "three";
import { cloudVertexShader, cloudFragmentShader } from "@/shaders/clouds";

export function CloudLayer() {
  const materialRef = useRef<ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: 0.35 },
    }),
    []
  );

  useFrame((_, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
    }
  });

  // In ECEF, Earth's radius is ~6,371,000m. Clouds sit ~10km above surface.
  // The TilesRenderer group has rotation [-PI/2, 0, 0] (Z-up to Y-up).
  // We place the cloud sphere concentric with Earth at radius = Earth + cloud altitude.
  const EARTH_RADIUS = 6_371_000;
  const CLOUD_ALTITUDE = 10_000;
  const cloudRadius = EARTH_RADIUS + CLOUD_ALTITUDE;

  return (
    <mesh>
      <sphereGeometry args={[cloudRadius, 64, 32]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={cloudVertexShader}
        fragmentShader={cloudFragmentShader}
        uniforms={uniforms}
        transparent
        side={DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}
```

- [ ] **Step 3: Add CloudLayer to MapViewer**

Add as a **child** of `<GoogleTilesLayer>` in `components/map-viewer.tsx` (inherits the Z-up to Y-up rotation):
```typescript
import { CloudLayer } from "./cloud-layer";

// Inside GoogleTilesLayer children, alongside ParcelLayer:
<GoogleTilesLayer ref={tilesRef} apiToken={apiToken}>
  <ParcelLayer />
  <CloudLayer />
</GoogleTilesLayer>
```

- [ ] **Step 4: Test visually**

Run `npm run dev`. Expected: subtle animated clouds drifting across the scene above the terrain.

- [ ] **Step 5: Commit**

```bash
git add shaders/clouds.ts components/cloud-layer.tsx components/map-viewer.tsx
git commit -m "feat: add procedural cloud shader layer"
```

---

### Task 15: Camera Fly-In Animation

**Files:**
- Create: `components/camera-fly-in.tsx`
- Modify: `components/map-viewer.tsx`

- [ ] **Step 1: Create camera fly-in component**

Create `components/camera-fly-in.tsx`:
```typescript
"use client";

import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, MathUtils } from "three";

interface CameraFlyInProps {
  tilesRef: React.RefObject<any>;
  /** Target lat in degrees */
  targetLat: number;
  /** Target lon in degrees */
  targetLon: number;
  /** Duration in seconds */
  duration?: number;
}

export function CameraFlyIn({
  tilesRef,
  targetLat,
  targetLon,
  duration = 3,
}: CameraFlyInProps) {
  const { camera } = useThree();
  const startTime = useRef<number | null>(null);
  const startPos = useRef(new Vector3());
  const targetPos = useRef(new Vector3());
  const done = useRef(false);

  useEffect(() => {
    startPos.current.copy(camera.position);
  }, [camera]);

  useFrame((state) => {
    if (done.current) return;

    const tiles = tilesRef.current;
    if (!tiles || !tiles.ellipsoid) return;

    if (startTime.current === null) {
      startTime.current = state.clock.elapsedTime;

      // Compute target ECEF position above José Ignacio
      tiles.ellipsoid.getCartographicToPosition(
        MathUtils.degToRad(targetLat),
        MathUtils.degToRad(targetLon),
        3000, // 3km altitude
        targetPos.current
      );
      targetPos.current.applyMatrix4(tiles.group.matrixWorld);
    }

    const elapsed = state.clock.elapsedTime - startTime.current;
    const t = Math.min(elapsed / duration, 1);

    // Ease-out cubic
    const eased = 1 - Math.pow(1 - t, 3);

    camera.position.lerpVectors(startPos.current, targetPos.current, eased);

    // Keep camera looking at the Earth's center (origin) during fly-in
    camera.lookAt(0, 0, 0);

    if (t >= 1) {
      done.current = true;
    }

    state.invalidate();
  });

  return null;
}
```

- [ ] **Step 2: Add CameraFlyIn to MapViewer**

Add inside Canvas in `components/map-viewer.tsx`:
```typescript
import { CameraFlyIn } from "./camera-fly-in";
import { JOSE_IGNACIO_CENTER } from "@/lib/constants";

// Inside Canvas:
<CameraFlyIn
  tilesRef={tilesRef}
  targetLat={JOSE_IGNACIO_CENTER.lat}
  targetLon={JOSE_IGNACIO_CENTER.lon}
/>
```

- [ ] **Step 3: Test the fly-in**

Run `npm run dev`. Expected: page loads showing Earth from space, then camera smoothly flies into José Ignacio over ~3 seconds, settling at ~3km altitude.

- [ ] **Step 4: Commit**

```bash
git add components/camera-fly-in.tsx components/map-viewer.tsx
git commit -m "feat: add camera fly-in animation to José Ignacio on load"
```

---

### Task 16: Final Polish and Build Verification

**Files:**
- Modify: various for fixes

- [ ] **Step 1: Run production build**

```bash
npm run build
```

Fix any TypeScript or build errors.

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 3: Test on Vercel preview**

```bash
npx vercel --prod
```

Or push to a branch and let Vercel deploy. Verify:
- Globe loads with Google 3D tiles
- 5 parcel polygons visible in José Ignacio area
- Pill labels floating above parcels
- Click parcel → grey detail card appears
- Contact Agent button works (WhatsApp link)
- Clouds drift subtly across the scene
- Camera flies in on load
- Mobile: card constrains to viewport width

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: fix build issues and polish for production"
```

---

## Dependency Graph

```
Task 1 (scaffold) → Task 2 (pages) → Task 3 (geo-utils) → Task 4 (parcel data)
                                                ↓
Task 5 (Google Tiles) → Task 6 (MapViewer) → Task 7 (GeoJSON overlay)
                                    ↓
Task 8 (selection state) → Task 9 (click detection)
                                    ↓
Task 10 (top bar) ──┐
Task 11 (pills) ────┤→ Task 13 (wire up projection)
Task 12 (card) ─────┘
                                    ↓
Task 14 (clouds) → Task 15 (fly-in) → Task 16 (polish)
```

Tasks 3-4 can run in parallel with Task 5.
Tasks 10-12 can run in parallel with each other.
Task 14-15 can run in parallel with each other.
