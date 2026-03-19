# El Pela — Cinematic Atmosphere & Visual Polish

## Overview

Upgrade the viewer from flat gradient sky + fixed lighting to physically-based atmospheric rendering. The goal: match the visual quality of CesiumJS demos (William Holmberg, Bilawal Sidhu) while staying on our R3F + 3d-tiles-renderer stack.

**Motivation:** The current viewer shows Google Photorealistic 3D Tiles with a canvas gradient sky and a single directional light. Compared to CesiumJS-based viewers, it looks flat — no aerial perspective, no atmosphere scattering, no time-of-day lighting. These are the five visual systems CesiumJS provides natively that we lack.

**Target:** Premium real estate presentation. Golden hour warmth. Distant terrain fading into atmospheric haze. The viewer should feel cinematic, not technical.

## Phased Roadmap (Updated)

| Phase | Scope | Status |
|-------|-------|--------|
| **1 — Viewer MVP** | Google 3D Tiles + parcel overlays + floating cards + clouds | Done |
| **1.5 — Cinematic Atmosphere** | Physically-based sky, aerial perspective, time-of-day lighting | This spec |
| 2 — Draw Tool | Click-to-draw polygon editor | Future |
| 3 — Gaussian Splats | Per-parcel immersive splat views blended into 3D tiles | Future |

## New Dependencies

| Package | Purpose | Size Impact |
|---------|---------|-------------|
| `@takram/three-atmosphere` | Sky scattering, aerial perspective, sun/sky lights | ~60KB |
| `@takram/three-geospatial` | Core GIS rendering utilities (peer dep) | ~20KB |
| `@react-three/postprocessing` | Effect composer for aerial perspective pass | ~40KB |
| `postprocessing` | Underlying post-processing library (peer dep) | ~120KB |

**Optional (Phase 1.5b):**

| Package | Purpose |
|---------|---------|
| `@takram/three-clouds` | Volumetric clouds with shadow maps (replaces our GLSL noise plane) |

### Why Takram's three-geospatial?

- Purpose-built for 3d-tiles-renderer + Three.js/R3F — our exact stack
- Proven with Google Photorealistic 3D Tiles (Storybook demos for Manhattan, Tokyo, London)
- Implements Bruneton's precomputed atmospheric scattering — same physics basis as CesiumJS
- R3F-native components (`<Atmosphere>`, `<Sky>`, `<SunLight>`, `<AerialPerspective>`)
- Reference implementation exists: [jeantimex/geospatial](https://github.com/jeantimex/geospatial)

## Architecture

### Current State

```
Canvas
├── <color background="#111111" />
├── ambientLight
├── directionalLight (fixed position)
├── GoogleTilesLayer > ParcelLayer
├── GlobeClickHandler
├── ScreenProjector
└── CloudLayer (GLSL noise plane)
```

Background is a static canvas gradient texture set via `scene.background`.

### Target State

```
Canvas
├── Atmosphere (provider, manages sun position from date)
│   ├── Sky (Rayleigh/Mie scattering dome)
│   ├── SunLight (atmosphere-aware directional light)
│   ├── SkyLight (hemisphere light from sky irradiance)
│   ├── GoogleTilesLayer > ParcelLayer
│   ├── GlobeClickHandler
│   ├── ScreenProjector
│   ├── CloudLayer (keep existing or upgrade to @takram/three-clouds)
│   └── EffectComposer
│       └── AerialPerspective (distance haze post-process)
```

### Key Changes

1. **`<Atmosphere date={date}>`** wraps the entire scene. Computes sun position from a JS `Date`. Provides context to child components (`Sky`, `SunLight`, `SkyLight`, `AerialPerspective`).

2. **`<Sky />`** replaces our canvas gradient `scene.background`. Renders physically-based sky with Rayleigh scattering (blue) and Mie scattering (sun glow). Rendered as a full-screen pass, not a mesh — bypasses the `camera.far` clipping issue we hit earlier.

3. **`<SunLight />`** replaces our fixed `<directionalLight>`. Computes sun transmittance through the atmosphere so lighting color shifts with time of day (warm at golden hour, cool at noon).

4. **`<SkyLight />`** replaces our `<ambientLight>`. Provides hemisphere illumination derived from the sky's irradiance.

5. **`<AerialPerspective />`** is a post-processing effect. Tints distant pixels toward the sky color based on depth — the single biggest visual upgrade. Distant terrain and buildings fade into blue haze exactly like CesiumJS. Requires `@react-three/postprocessing`'s `<EffectComposer>`.

6. **Remove `<color attach="background" />`** and the `SkyDome` component. The `<Sky />` component handles background rendering.

7. **Remove `SUN_POSITION` constant.** Sun position is now computed dynamically from `date`.

## Components

### `components/atmosphere-provider.tsx` (new)

Wraps the scene in Takram's `<Atmosphere>` provider. Accepts a `date` prop (defaults to current time or a fixed golden-hour time for consistent presentation).

```tsx
import { Atmosphere, Sky, AerialPerspective, SunLight, SkyLight } from '@takram/three-atmosphere/r3f';
import { EffectComposer } from '@react-three/postprocessing';

interface AtmosphereProviderProps {
  date?: Date;
  children: React.ReactNode;
}

export function AtmosphereProvider({ date, children }: AtmosphereProviderProps) {
  // Default to golden hour in José Ignacio (UTC-3, ~6:30pm local ≈ 21:30 UTC)
  const sunDate = date ?? new Date('2026-01-15T21:30:00Z');

  return (
    <Atmosphere date={sunDate}>
      <Sky />
      <SunLight intensity={2} />
      <SkyLight intensity={1.5} />
      {children}
      <EffectComposer>
        <AerialPerspective />
      </EffectComposer>
    </Atmosphere>
  );
}
```

### `components/map-viewer.tsx` (modified)

Replace `ambientLight`, `directionalLight`, `SkyDome`, and `<color>` background with `<AtmosphereProvider>`:

```tsx
<Canvas camera={{ position: INITIAL_CAMERA_POSITION, near: 1, far: 4e7 }}>
  <AtmosphereProvider>
    <GoogleTilesLayer ref={tilesRef} apiToken={apiToken}>
      <ParcelLayer />
    </GoogleTilesLayer>
    <GlobeClickHandler tilesRef={tilesRef} />
    <ScreenProjector tilesRef={tilesRef} />
    <CloudLayer />
  </AtmosphereProvider>
</Canvas>
```

### `components/sun-flare.tsx` → deleted

No longer needed. Sky rendering is handled by `<Sky />` from three-atmosphere.

### `components/cloud-layer.tsx` (keep or upgrade)

**Option A (keep):** The existing GLSL noise plane works fine alongside the atmosphere. Lower priority to change.

**Option B (upgrade to Takram clouds):** Replace with `@takram/three-clouds` for volumetric clouds with Beer Shadow Maps that cast shadows on terrain. This is a separate scope item (Phase 1.5b).

### `lib/constants.ts` (modified)

Remove `SUN_POSITION`. Add `GOLDEN_HOUR_DATE`:

```typescript
/** Golden hour in José Ignacio — warm light for real estate presentation */
export const GOLDEN_HOUR_DATE = new Date('2026-01-15T21:30:00Z');
```

## Visual Targets

| Aspect | Current | Target |
|--------|---------|--------|
| Sky | Static canvas gradient (blue→green) | Physically-based scattering, rotates with camera |
| Horizon | Abrupt edge between tiles and gradient | Smooth atmospheric fade |
| Distant terrain | Same brightness as near terrain | Fades into blue haze (aerial perspective) |
| Lighting color | Fixed white directional | Warm golden hour tint from sun transmittance |
| Ambient | Fixed white ambient | Sky-derived hemisphere light (blue from above, warm from below) |
| Shadows | None | Sun-cast shadows via SunLight (if tiles support) |

## Integration Notes

### AerialPerspective and Material Type

`AerialPerspective` works best when tiles use `MeshBasicMaterial` (unlit) because it applies lighting as a post-process. Google Photorealistic Tiles come with baked lighting in textures, so they are effectively unlit — this is well-suited.

### GlobeControls camera.far Interaction

GlobeControls dynamically adjusts `camera.far` each frame. Takram's `<Sky />` renders as a full-screen shader pass (not a mesh), so it is unaffected by far-plane clipping. This solves the black sky problem we hit with mesh-based sky domes.

### Terrain Exaggeration

The current 2.5x Y-scale on the ECEF group should be preserved. The atmosphere rendering is independent of terrain scale.

### Performance

- Precomputed atmospheric scattering uses lookup textures (computed once at init) — negligible per-frame cost
- `AerialPerspective` is a single full-screen post-processing pass — similar cost to any other post-process effect
- No measurable FPS impact expected on any modern GPU

## Files Changed

| File | Action |
|------|--------|
| `components/atmosphere-provider.tsx` | **New** — Atmosphere + Sky + lights + post-processing |
| `components/map-viewer.tsx` | **Modified** — wrap scene in AtmosphereProvider, remove old lights/background |
| `components/sun-flare.tsx` | **Deleted** — replaced by atmosphere system |
| `lib/constants.ts` | **Modified** — replace SUN_POSITION with GOLDEN_HOUR_DATE |
| `shaders/lens-flare.ts` | **Deleted** — no longer used (if not already) |
| `package.json` | **Modified** — add new dependencies |

## Out of Scope

- Time-of-day slider UI (future enhancement — the `date` prop is ready for it)
- Volumetric clouds upgrade (Phase 1.5b)
- Gaussian splat integration (Phase 3)
- Night mode / thermal view modes
- Environment reflections / IBL on custom objects
