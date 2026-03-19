# Cinematic Atmosphere Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat gradient sky and fixed lighting with physically-based atmospheric scattering, aerial perspective haze, and time-of-day lighting using Takram's three-atmosphere library.

**Architecture:** Wrap the scene in an `<Atmosphere>` context provider that computes sun position from a date. `<Sky>` renders the physically-based sky as a full-screen pass (bypassing GlobeControls' dynamic far-plane clipping). `<AerialPerspective>` applies distance haze and sun/sky illumination as post-processing. The existing `SkyDome` gradient component and fixed lights are removed.

**Tech Stack:** `@takram/three-atmosphere` (sky, lights), `@takram/three-geospatial` (ellipsoid math), `@react-three/postprocessing` + `postprocessing` (effect composer), `@takram/three-geospatial-effects` (dithering).

**Spec:** `docs/superpowers/specs/2026-03-18-cinematic-atmosphere-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `package.json` | Modify | Add 4 new dependencies |
| `next.config.ts` | Modify | Add transpilePackages for Takram + postprocessing |
| `components/atmosphere-layer.tsx` | Create | Atmosphere provider + Sky + AerialPerspective + post-processing |
| `components/map-viewer.tsx` | Modify | Remove old lights/SkyDome, wrap scene in AtmosphereLayer |
| `components/sun-flare.tsx` | Delete | Replaced by atmosphere system |
| `lib/constants.ts` | Modify | Replace SUN_POSITION with GOLDEN_HOUR_DATE |

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install atmosphere and postprocessing packages**

```bash
npm install @takram/three-atmosphere @takram/three-geospatial @react-three/postprocessing postprocessing @takram/three-geospatial-effects
```

- [ ] **Step 2: Verify installation**

```bash
node -e "require.resolve('@takram/three-atmosphere')" && echo "OK"
```

Expected: `OK` (no error)

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add @takram/three-atmosphere and postprocessing for cinematic sky"
```

---

## Task 2: Configure Next.js Transpilation

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Add Takram and postprocessing packages to transpilePackages**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "three",
    "3d-tiles-renderer",
    "@takram/three-atmosphere",
    "@takram/three-geospatial",
    "@takram/three-geospatial-effects",
    "postprocessing",
  ],
};

export default nextConfig;
```

- [ ] **Step 2: Verify dev server starts without errors**

```bash
npm run dev
```

Check terminal for compilation errors. The dev server should start without import/transpile errors.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "config: transpile Takram atmosphere packages for Next.js"
```

---

## Task 3: Update Constants

**Files:**
- Modify: `lib/constants.ts`

- [ ] **Step 1: Replace SUN_POSITION with GOLDEN_HOUR_DATE**

Replace the `SUN_POSITION` export with a golden hour date for José Ignacio. January 15 at 21:30 UTC = ~6:30pm local (UTC-3) — warm golden hour light.

```ts
export const JOSE_IGNACIO_CENTER = { lat: -34.7925, lon: -54.6335 } as const;
/** Camera ~1km altitude at a low angle to show terrain relief */
export const INITIAL_CAMERA_POSITION: [number, number, number] = [3000, 1200, 3000];
/** Golden hour in José Ignacio (Jan 15, ~6:30pm local = 21:30 UTC) */
export const GOLDEN_HOUR_DATE = new Date('2026-01-15T21:30:00Z');
export const PARCEL_COLORS: {
  fill: string;
  fillHover: string;
  fillSelected: string;
  stroke: string;
  strokeHover: string;
  strokeSelected: string;
  strokeWidth: number;
  strokeWidthSelected: number;
} = {
  fill: "rgba(0, 200, 255, 0.15)",
  fillHover: "rgba(0, 200, 255, 0.3)",
  fillSelected: "rgba(0, 200, 255, 0.4)",
  stroke: "rgba(0, 255, 180, 0.6)",
  strokeHover: "rgba(0, 255, 180, 0.9)",
  strokeSelected: "rgba(0, 200, 255, 1)",
  strokeWidth: 2,
  strokeWidthSelected: 4,
};
```

- [ ] **Step 2: Commit**

```bash
git add lib/constants.ts
git commit -m "chore: replace SUN_POSITION with GOLDEN_HOUR_DATE constant"
```

---

## Task 4: Create AtmosphereLayer Component

**Files:**
- Create: `components/atmosphere-layer.tsx`

This is the core new component. It wraps scene content in Takram's `<Atmosphere>` provider, renders the physically-based `<Sky>`, and applies `<AerialPerspective>` post-processing with sun/sky illumination.

- [ ] **Step 1: Create the atmosphere-layer component**

```tsx
"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { EffectComposer, ToneMapping, SMAA } from "@react-three/postprocessing";
import {
  Atmosphere,
  Sky,
  AerialPerspective,
  type AtmosphereApi,
} from "@takram/three-atmosphere/r3f";
import { Ellipsoid, Geodetic, radians } from "@takram/three-geospatial";
import { Dithering } from "@takram/three-geospatial-effects/r3f";
import { JOSE_IGNACIO_CENTER, GOLDEN_HOUR_DATE } from "@/lib/constants";

/**
 * Physically-based atmosphere rendering for the 3D viewer.
 *
 * Provides:
 * - Sky with Rayleigh/Mie scattering (replaces canvas gradient SkyDome)
 * - Aerial perspective (distant terrain fades into blue haze)
 * - Post-process sun + sky illumination (replaces directionalLight + ambientLight)
 * - Tone mapping and anti-aliasing
 *
 * The worldToECEFMatrix is set to match ReorientationPlugin's recentering
 * so the atmosphere aligns with the globe position of José Ignacio.
 */
export function AtmosphereLayer({ children }: { children: React.ReactNode }) {
  const atmosphereRef = useRef<AtmosphereApi>(null);

  // Set the world-to-ECEF matrix to match ReorientationPlugin's recentered origin
  useEffect(() => {
    const atm = atmosphereRef.current;
    if (!atm) return;

    const ecef = new Geodetic(
      radians(JOSE_IGNACIO_CENTER.lon),
      radians(JOSE_IGNACIO_CENTER.lat),
      0,
    ).toECEF();

    Ellipsoid.WGS84.getNorthUpEastFrame(ecef, atm.worldToECEFMatrix);
  }, []);

  // Update sun position each frame from golden hour date
  useFrame(() => {
    atmosphereRef.current?.updateByDate(GOLDEN_HOUR_DATE);
  });

  return (
    <Atmosphere ref={atmosphereRef} correctAltitude>
      <Sky />
      {children}
      <EffectComposer enableNormalPass multisampling={0}>
        <AerialPerspective sunLight skyLight correctGeometricError />
        <ToneMapping />
        <SMAA />
        <Dithering />
      </EffectComposer>
    </Atmosphere>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/atmosphere-layer.tsx
git commit -m "feat: add AtmosphereLayer with physically-based sky and aerial perspective"
```

---

## Task 5: Wire Up map-viewer and Remove Old Sky/Lights

**Files:**
- Modify: `components/map-viewer.tsx`
- Delete: `components/sun-flare.tsx`

- [ ] **Step 1: Update map-viewer to use AtmosphereLayer**

Replace the old lights, SkyDome import, and SUN_POSITION with the new AtmosphereLayer wrapper:

```tsx
"use client";

import { useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { GoogleTilesLayer } from "./google-tiles-layer";
import { GlobeClickHandler } from "./globe-click-handler";
import { ScreenProjector } from "./screen-projector";
import { ParcelPillsOverlay } from "./parcel-pills";
import { ParcelCard } from "./parcel-card";
import { TopBar } from "./top-bar";
import { getParcels } from "@/lib/parcels";
import { usePillPositions } from "@/lib/use-pill-positions";
import { ParcelLayer } from "./parcel-layer";
import { CloudLayer } from "./cloud-layer";
import { AtmosphereLayer } from "./atmosphere-layer";
import { INITIAL_CAMERA_POSITION } from "@/lib/constants";

function Overlays({ parcelCount }: { parcelCount: number }) {
  const positions = usePillPositions((s) => s.positions);
  const selectedPos = usePillPositions((s) => s.selectedPos);

  return (
    <>
      <TopBar parcelCount={parcelCount} />
      <ParcelPillsOverlay positions={positions} />
      {selectedPos && (
        <ParcelCard screenX={selectedPos.x} screenY={selectedPos.y} />
      )}
    </>
  );
}

export function MapViewer() {
  const apiToken = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const tilesRef = useRef<any>(null);
  const parcels = useMemo(() => getParcels(), []);

  if (!apiToken || apiToken === "YOUR_API_KEY_HERE") {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a] text-sm text-white/50">
        Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen">
      <Canvas camera={{ position: INITIAL_CAMERA_POSITION, near: 1, far: 4e7 }}>
        <AtmosphereLayer>
          <GoogleTilesLayer ref={tilesRef} apiToken={apiToken}>
            <ParcelLayer />
          </GoogleTilesLayer>
          <GlobeClickHandler tilesRef={tilesRef} />
          <ScreenProjector tilesRef={tilesRef} />
          <CloudLayer />
        </AtmosphereLayer>
      </Canvas>

      <Overlays parcelCount={parcels.features.length} />
    </div>
  );
}
```

Key changes:
- Removed `<color attach="background" />`
- Removed `<ambientLight>` and `<directionalLight>` (replaced by AerialPerspective's sunLight/skyLight)
- Removed `<SkyDome />` import and usage
- Removed `SUN_POSITION` import
- Wrapped everything inside `<AtmosphereLayer>`

- [ ] **Step 2: Delete the old sun-flare.tsx**

```bash
rm components/sun-flare.tsx
```

- [ ] **Step 3: Delete the unused lens-flare shader if still present**

```bash
rm -f shaders/lens-flare.ts
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors. If there are errors about unused imports or missing files, fix them.

- [ ] **Step 5: Commit**

```bash
git add components/map-viewer.tsx components/atmosphere-layer.tsx
git add -u  # stages the deleted sun-flare.tsx and lens-flare.ts
git commit -m "feat: replace flat lighting with Takram atmosphere — sky, aerial perspective, sun/sky illumination"
```

---

## Task 6: Build Verification and Visual Check

**Files:** None (verification only)

- [ ] **Step 1: Run tests**

```bash
npx vitest run
```

Expected: all tests pass (the atmosphere changes don't affect unit tests).

- [ ] **Step 2: Run production build**

```bash
npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 3: Visual verification**

Open `http://localhost:3000/viewer` in Chrome. Verify:
- Sky shows a physically-based blue gradient with atmospheric scattering (not the old canvas gradient or black)
- Distant terrain fades into blue haze (aerial perspective)
- Lighting has warm golden-hour tint (not flat white)
- Parcels still render as cyan overlays on the terrain
- Map controls still work (pan, zoom, right-click rotate)
- Cloud layer still visible
- No console errors related to atmosphere/postprocessing

If the sky is black or tiles don't render, check:
1. Console for GLSL compilation errors (atmosphere shaders)
2. The `worldToECEFMatrix` setup — if sun appears in wrong position, the frame orientation may not match. Try with `correctAltitude={false}` as a fallback.
3. If `EffectComposer` breaks tile rendering, try removing `enableNormalPass` or `multisampling={0}`.

- [ ] **Step 4: Final commit if any adjustments were needed**

```bash
git add -A
git commit -m "fix: atmosphere visual adjustments after testing"
```

---

## Troubleshooting Guide

### Black sky / tiles don't render
- Check if `EffectComposer` is causing issues — try removing it temporarily to isolate
- Check console for GLSL errors from atmosphere shaders
- Verify `transpilePackages` in `next.config.ts` includes all Takram packages

### Sun in wrong position
- The `worldToECEFMatrix` may not match the ECEF rotation + ReorientationPlugin transform
- Try changing `getNorthUpEastFrame` to `getEastNorthUpFrame` or manually constructing the matrix
- Verify with `correctAltitude={false}` to simplify

### Aerial perspective too strong / too weak
- Adjust AerialPerspective props: try adding `albedoScale={1.5}` or removing `inscatter`
- The 2.5x terrain exaggeration may cause altitude mismatches — set `correctAltitude={false}` if needed

### Performance issues
- Reduce `multisampling` to `0` on EffectComposer
- Remove `<SMAA />` if it's redundant with multisampling
- The precomputed atmosphere textures are generated once at init — if there's a loading stall, add `textures` prop pointing to precomputed files
