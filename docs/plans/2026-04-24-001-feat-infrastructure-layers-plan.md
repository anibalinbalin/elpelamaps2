---
title: "feat: Add infrastructure layers to master plan viewer"
type: feat
status: active
date: 2026-04-24
origin: docs/brainstorms/infrastructure-layers-requirements.md
---

# feat: Add infrastructure layers to master plan viewer

## Overview

Extend the 3D globe viewer and 2D editor to render five new infrastructure feature types — water bodies, green spaces, trees, building footprints, and sidewalks — alongside existing parcels and roads. The goal is photorealistic master plan visualization on Google 3D Tiles that makes clients see a real subdivision, not a wireframe.

---

## Problem Frame

The viewer currently renders only parcel polygons. Roads and amenities exist in the data model but are invisible on the 3D globe. Real estate clients expect a complete master plan showing lagunas, trees, roads, green spaces, and buildings. Reference: AURA master plan (Punta del Este). (see origin: `docs/brainstorms/infrastructure-layers-requirements.md`)

---

## Requirements Trace

- R1. Expand FeatureType enum with water, greenspace, tree, building, sidewalk
- R2. Viewer renders all feature types with distinct visual treatment
- R3. Editor supports drawing/editing all new types including Point geometry
- R4. Per-type styling in the editor
- R5. Layer visibility toggle in both editor and viewer

---

## Scope Boundaries

- No cinematic reveal sequence (deferred)
- No surrounding context POI labels (deferred)
- No section/neighborhood grouping badges (deferred)
- No utility corridors, street lighting, signage
- No procedural tree placement — manual only
- No illustrated/stylized rendering — photorealistic only

---

## Context & Research

### Relevant Code and Patterns

- `lib/parcels.ts` — FeatureType union, ParcelProperties interface, ParcelFeature type alias. GeoJSON-based with Polygon | LineString geometry support. No Point geometry yet.
- `components/viewer-v2.tsx` — ParcelLayer component builds 3D geometry from GeoJSON features. Uses fan triangulation (lines 393-407), `ellipsoid.getCartographicToPosition()` for coordinate conversion, `MeshBasicMaterial` with `depthWrite: false, depthTest: false`. All features treated as parcel polygons — no dispatch by featureType.
- `components/editor-v2.tsx` — `DRAW_TYPES` map (line 191) maps featureType to OL geometry type. `FEATURE_STYLES` (line 82) defines per-type colors. Inspector panel shows different fields per type. `recreateDraw()` creates OL Draw interaction.
- `app/api/parcels/route.ts` — `isParcelFeature()` validates geometry type as Polygon or LineString only. Needs Point support.

### External References

- Three.js Water2 (`three/examples/jsm/objects/Water2`) — bundled with Three.js 0.183, works as flat plane oriented to surface normal. Each instance renders 2 extra passes (reflection + refraction). Limit to 1-3 water bodies.
- Three.js `InstancedMesh` — single draw call for 500+ tree sprites. Requires per-instance matrix update in `useFrame` for billboard effect on globe (surface normal varies per tree).
- `THREE.Earcut.triangulate` — built into Three.js, no extra package needed. Current fan triangulation fails on concave polygons.
- `THREE.ExtrudeGeometry` with `THREE.Shape` — handles building extrusion including holes. Must work in local tangent-plane (ENU) coordinates, then transform back to ECEF.
- Ribbon mesh for roads/sidewalks — manual geometry construction with miter joins in 3D ECEF space. No existing library handles globe-curved roads correctly.

---

## Key Technical Decisions

- **Earcut over fan triangulation:** Current fan triangulation (vertex 0 as center) fails on concave polygons. Switch all polygon rendering to earcut. This is a correctness fix that also benefits existing parcels.
- **Water2 as oriented flat plane:** Water bodies span ~100-300m where ellipsoid curvature is negligible. Position a flat PlaneGeometry at centroid, orient to surface normal via `getObjectFrame()`. Gate reflection rendering behind a camera distance check.
- **CPU billboard matrices for trees:** Use `InstancedMesh` + `PlaneGeometry` with per-frame matrix updates in `useFrame`. Each tree's "up" = surface normal at its position. ~0.1ms per frame for 500 instances. Vertex shader approach not needed below 2000 trees.
- **Local ENU coordinate system for building extrusion:** Project polygon vertices to local East-North-Up plane at centroid, extrude along local Z (= surface up), transform result back to ECEF via `getObjectFrame()` matrix.
- **Manual ribbon mesh for roads/sidewalks:** Compute offset vectors in tangent plane at each vertex, build triangle strip with miter joins. Clamp miter length at 4x width for acute angles.
- **Layered elevation offsets for z-fighting:** Assign each layer a distinct elevation above terrain (green=0.15m, water=0.10m, road=0.30m, sidewalk=0.45m, parcel=0.60m, outlines=0.75m). Combine with `polygonOffset` and `renderOrder`. Switch from `depthTest: false` to `depthTest: true` for new layers to preserve terrain occlusion.
- **Road width in meters, not pixels:** Current `roadWidth` property is in editor pixels. New approach: width in meters, converted to world-space ribbon mesh geometry.

---

## Open Questions

### Resolved During Planning

- **Water shader type:** Water2 (reflective + animated ripples), not flat tinted plane. Decision from brainstorm.
- **Tree approach:** Billboard sprites via InstancedMesh, not 3D models or canopy circles. Decision from brainstorm.
- **Earcut availability:** Built into Three.js, no npm install needed. Confirmed in node_modules.

### Deferred to Implementation

- **Water2 normal map textures:** Which normal map textures to use. Three.js examples bundle two options — try both at implementation time.
- **Tree texture atlas:** Single tree image vs multi-variant atlas. Start with one image, iterate.
- **Exact color values for new layer materials:** Start with values from editor FEATURE_STYLES and tune visually.
- **Building material:** MeshBasicMaterial vs MeshStandardMaterial. Standard gives shadows but needs a light source. Try both.

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
GeoJSON Feature
  │
  ├─ featureType dispatch
  │
  ├─ "parcel"    → earcut triangulation → MeshBasicMaterial (status colors)
  ├─ "road"      → ribbon mesh (width m) → MeshBasicMaterial (grey asphalt)
  ├─ "water"     → Water2 plane at centroid, oriented to surface normal
  ├─ "greenspace" → earcut triangulation → MeshBasicMaterial (soft green)
  ├─ "tree"      → InstancedMesh billboard sprite (per-frame matrix update)
  ├─ "building"  → ENU-projected ExtrudeGeometry → MeshBasicMaterial (neutral)
  └─ "sidewalk"  → ribbon mesh (narrow width) → MeshBasicMaterial (cream)

Elevation layering (meters above terrain):
  0.10  water
  0.15  greenspace
  0.30  road
  0.45  sidewalk
  0.60  parcel fill
  0.75  outlines
```

---

## Implementation Units

- [ ] U1. **Expand data model and API validation**

**Goal:** Add new feature types and Point geometry support to the type system and API.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `lib/parcels.ts`
- Modify: `app/api/parcels/route.ts`

**Approach:**
- Extend `FeatureType` union: `"parcel" | "road" | "amenity" | "water" | "greenspace" | "tree" | "building" | "sidewalk"`
- Add new optional properties to `ParcelProperties`: `canopyRadius?: number` (trees, meters), `height?: number` (buildings, meters), `floors?: number` (buildings, integer)
- Extend `ParcelFeature` geometry union: `Polygon | LineString | Point`
- Update `isParcelFeature()` validation to accept Point geometry
- Keep `areaSqMeters` as 0 for Point features

**Patterns to follow:**
- Existing `ParcelProperties` interface pattern for optional fields
- Existing `isParcelFeature()` validation logic

**Test scenarios:**
- Happy path: API accepts a PUT with a tree feature (Point geometry) and returns it in GET
- Happy path: API accepts water feature (Polygon) with featureType "water"
- Edge case: Point feature with areaSqMeters=0 passes validation
- Error path: Feature with unknown geometry type (e.g., MultiPolygon) is rejected

**Verification:**
- All existing parcel data continues to load and save correctly
- New feature types round-trip through the API

---

- [ ] U2. **Replace fan triangulation with earcut in viewer**

**Goal:** Fix polygon rendering for concave shapes. This is a prerequisite for water bodies and green spaces which may be concave/irregular.

**Requirements:** R2 (correctness foundation)

**Dependencies:** U1

**Files:**
- Modify: `components/viewer-v2.tsx`

**Approach:**
- Replace the fan triangulation loop (currently at ~lines 393-407) with earcut-based triangulation
- Use `THREE.Earcut.triangulate` (built into Three.js) or the earcut algorithm directly
- Project polygon vertices to a local 2D tangent plane for triangulation (earcut needs 2D input), then use the resulting triangle indices with the original 3D ECEF positions
- The surface normal at the polygon centroid defines the projection plane

**Patterns to follow:**
- Existing vertex-to-ECEF conversion via `ellipsoid.getCartographicToPosition()`
- Existing `BufferGeometry` + `Float32BufferAttribute` construction

**Test scenarios:**
- Happy path: Convex parcel renders identically to current behavior
- Edge case: Concave L-shaped polygon renders correctly (fan triangulation would produce overlapping triangles)
- Edge case: Polygon with only 3 vertices (triangle) renders correctly

**Verification:**
- Existing parcels render visually unchanged
- A concave test polygon renders without visual artifacts

---

- [ ] U3. **Refactor viewer to dispatch rendering by featureType**

**Goal:** Split the monolithic ParcelLayer rendering into per-type renderers so each infrastructure element gets its own visual treatment.

**Requirements:** R2

**Dependencies:** U1, U2

**Files:**
- Modify: `components/viewer-v2.tsx`

**Approach:**
- Filter features by featureType when building render objects
- Create separate render groups per type: parcels group, roads group, water group, etc.
- Each group gets its own material palette and elevation offset
- Parcel rendering stays unchanged (earcut triangulation + status colors + badges)
- Road rendering: skip for now (implemented in U5)
- Water/greenspace/building/sidewalk/tree: placeholder groups, rendered in subsequent units
- Implement elevation layering constants (water=0.10m, green=0.15m, road=0.30m, sidewalk=0.45m, parcel=0.60m, outlines=0.75m)
- Switch new layers to `depthTest: true` with `polygonOffset` for proper terrain occlusion

**Patterns to follow:**
- Existing `ParcelRender` type and render loop structure
- Existing hover/selection material update pattern

**Test scenarios:**
- Happy path: Mixed feature collection (parcels + roads + amenities) renders parcels correctly, other types are silently skipped (ready for subsequent units)
- Edge case: Empty feature collection renders without error
- Integration: Feature type filter correctly separates parcels from non-parcels

**Verification:**
- Existing parcel rendering is visually unchanged
- Console shows no errors when non-parcel features are present in data

---

- [ ] U4. **Render water bodies with Water2 shader**

**Goal:** Render water/laguna polygons as animated reflective water surfaces on the globe.

**Requirements:** R2 (water rendering)

**Dependencies:** U3

**Files:**
- Modify: `components/viewer-v2.tsx`

**Approach:**
- For each feature with `featureType: "water"`:
  - Compute centroid and bounding box of the polygon
  - Create a `PlaneGeometry` sized to the bounding box
  - Apply Water2 shader with blue-green tint, subtle ripple animation, low reflectivity
  - Position at centroid using `ellipsoid.getCartographicToPosition()` at elevation 0.10m
  - Orient to surface normal using `getObjectFrame()` — the plane's local Z must align with ellipsoid surface normal
  - Gate reflection render passes behind a camera distance check (skip when camera > 5000m altitude)
- Water2 imports from `three/examples/jsm/objects/Water2`
- Normal map textures from `three/examples/textures/water/` (bundled with Three.js)

**Patterns to follow:**
- Existing `getObjectFrame()` usage in AnimatedCamera for frame orientation

**Test scenarios:**
- Happy path: Water polygon renders as animated blue surface with visible ripples
- Happy path: Water surface reflects sky/terrain when camera is close
- Edge case: Very small water body (< 20m across) renders without shader artifacts
- Edge case: Camera far away (> 5000m) — reflection passes are skipped for performance

**Verification:**
- A laguna-shaped polygon with featureType "water" shows animated water on the 3D globe
- Frame rate remains stable with 2-3 water bodies rendered

---

- [ ] U5. **Render roads and sidewalks as ribbon meshes**

**Goal:** Render LineString features (roads and sidewalks) as flat ribbon meshes with correct world-space width.

**Requirements:** R2 (road and sidewalk rendering)

**Dependencies:** U3

**Files:**
- Modify: `components/viewer-v2.tsx`

**Approach:**
- Build a ribbon mesh generator function that takes LineString coordinates + width in meters and produces a triangle strip BufferGeometry
- At each vertex: compute tangent vector, project to tangent plane (remove surface-normal component), compute perpendicular offset
- At interior vertices: compute miter direction from adjacent segment tangents, clamp miter length at 4x half-width
- Roads: grey asphalt material (MeshBasicMaterial, color ~0x888888, opacity 0.7), elevation 0.30m
- Sidewalks: cream material (color ~0xddd8c8, opacity 0.6), elevation 0.45m, narrower width
- Keep existing road line rendering as a fallback/outline if desired
- Width source: `roadWidth` property. For sidewalks, use a new `width` property or default to 1.5m

**Patterns to follow:**
- Existing `ellipsoid.getCartographicToPosition()` coordinate conversion
- Existing BufferGeometry construction with Float32BufferAttribute

**Test scenarios:**
- Happy path: Straight road segment renders as a flat ribbon with correct width
- Happy path: Road with multiple segments renders with smooth miter joins
- Edge case: Sharp turn (< 30 degree angle) clamps miter length instead of producing spikes
- Edge case: Road with only 2 points (single segment) renders correctly
- Edge case: Sidewalk renders narrower and at different elevation than road

**Verification:**
- Roads visible as flat grey surfaces following their LineString paths
- Sidewalks visible as narrower cream-colored ribbons
- No visual artifacts at road intersections or sharp turns

---

- [ ] U6. **Render green spaces as ground polygons**

**Goal:** Render greenspace polygons as subtle green-tinted ground surfaces.

**Requirements:** R2 (greenspace rendering)

**Dependencies:** U2, U3

**Files:**
- Modify: `components/viewer-v2.tsx`

**Approach:**
- Reuse the earcut triangulation from U2 for greenspace polygons
- Material: soft green MeshBasicMaterial (color ~0x4caf50, opacity 0.15), elevation 0.15m
- `depthTest: true`, `depthWrite: false`, `polygonOffset: true`
- No hover/selection interaction initially — green spaces are passive visual context

**Patterns to follow:**
- Parcel polygon rendering pattern (earcut triangulation + material)

**Test scenarios:**
- Happy path: Greenspace polygon renders as a subtle green overlay on terrain
- Edge case: Concave greenspace (e.g., park wrapping around a building) renders correctly via earcut

**Verification:**
- Green spaces visible as soft green areas distinguishable from terrain and parcels

---

- [ ] U7. **Render trees as instanced billboard sprites**

**Goal:** Render Point features as camera-facing tree sprites using a single InstancedMesh draw call.

**Requirements:** R2 (tree rendering)

**Dependencies:** U3

**Files:**
- Modify: `components/viewer-v2.tsx`
- Create: `public/textures/tree-sprite.png` (tree billboard texture, alpha-masked)

**Approach:**
- Collect all tree features from the data
- Create one `InstancedMesh` with a `PlaneGeometry` (width based on `canopyRadius` or default 6m, height ~1.5x width)
- Shift geometry origin to bottom edge so trees stand on the ground
- Material: `MeshBasicMaterial` with tree texture, `alphaTest: 0.5`, `DoubleSide`
- In `useFrame`: update per-instance matrices for cylindrical billboard effect
  - Each tree's "up" = normalized ECEF position (surface normal)
  - Camera direction projected onto tangent plane defines the "forward"
  - Build rotation matrix from (right, up, forward) basis vectors
- Set `frustumCulled = false` on the InstancedMesh (bounding sphere may not encompass all instances after matrix updates)
- Trees positioned at elevation 0 (base on terrain)

**Patterns to follow:**
- Existing `useFrame` pattern in badge distance calculation

**Test scenarios:**
- Happy path: 100 tree points render as tree sprites facing the camera
- Happy path: Trees rotate to face camera as the globe is orbited
- Edge case: Tree at a steep terrain slope still orients "up" along the local surface normal
- Edge case: 500+ trees render without noticeable frame drop

**Verification:**
- Trees visible as billboard sprites scattered across the development
- Sprites always face the camera regardless of viewing angle
- Frame rate stable with 500 instances

---

- [ ] U8. **Render building footprints as extruded geometry**

**Goal:** Render building polygons as extruded 3D boxes on the globe.

**Requirements:** R2 (building rendering)

**Dependencies:** U2, U3

**Files:**
- Modify: `components/viewer-v2.tsx`

**Approach:**
- For each building feature:
  - Compute centroid of footprint polygon
  - Get ENU (East-North-Up) frame matrix at centroid via `getObjectFrame()`
  - Invert the matrix to get ECEF-to-local transform
  - Project footprint vertices to local 2D (X=east, Y=north)
  - Create `THREE.Shape` from local 2D vertices
  - Use `ExtrudeGeometry` with `depth: height` (from `height` property or `floors * 3`)
  - `bevelEnabled: false`
  - Apply ENU frame matrix to transform geometry back to ECEF
- Material: MeshBasicMaterial, neutral grey (color ~0xcccccc, opacity 0.85)
- Default height: 6m (2 floors) when no height/floors property set

**Patterns to follow:**
- Existing `getObjectFrame()` usage in AnimatedCamera
- `ExtrudeGeometry` + `Shape` from Three.js

**Test scenarios:**
- Happy path: Rectangular building footprint renders as an extruded 3D box at correct height
- Happy path: Building with floors=3 renders at ~9m height
- Edge case: Irregular (non-rectangular) building footprint renders correctly via earcut in ExtrudeGeometry
- Edge case: Building with no height property defaults to 6m

**Verification:**
- Buildings visible as extruded 3D shapes rising from the ground
- Building height proportional to the height/floors property

---

- [ ] U9. **Add new feature types to editor**

**Goal:** Support drawing and editing all new feature types in the OpenLayers editor, including Point geometry for trees.

**Requirements:** R3, R4

**Dependencies:** U1

**Files:**
- Modify: `components/editor-v2.tsx`

**Approach:**
- Extend `DRAW_TYPES` map with new entries: `water: "Polygon"`, `greenspace: "Polygon"`, `tree: "Point"`, `building: "Polygon"`, `sidewalk: "LineString"`
- Extend `FEATURE_STYLES` with colors per new type:
  - water: `fill: "rgba(30, 136, 229, 0.15)"`, `stroke: "rgba(30, 136, 229, 0.8)"`
  - greenspace: `fill: "rgba(76, 175, 80, 0.12)"`, `stroke: "rgba(76, 175, 80, 0.7)"`
  - tree: point marker style (green circle, radius 4)
  - building: `fill: "rgba(158, 158, 158, 0.15)"`, `stroke: "rgba(158, 158, 158, 0.8)"`
  - sidewalk: `fill: "rgba(210, 200, 180, 0.08)"`, `stroke: "rgba(210, 200, 180, 0.75)"`
- Add Point draw interaction support: OL `Draw` with `type: "Point"`, single-click placement
- Update `featureStyle()` to handle Point geometry (return `CircleStyle` for trees)
- Extend feature type selector UI with new options
- Extend property inspector with per-type fields:
  - Tree: canopyRadius input (meters)
  - Building: height (meters) and floors (integer) inputs
  - Sidewalk: width (meters) input
  - Water/greenspace: name only
- Set sensible defaults on `drawend`: tree canopyRadius=4, building height=6, sidewalk width=1.5
- Update `FeatureGroup` sidebar to include new type groups

**Patterns to follow:**
- Existing `DRAW_TYPES` and `FEATURE_STYLES` maps
- Existing property inspector conditional rendering pattern
- Existing `drawend` handler for setting initial properties

**Test scenarios:**
- Happy path: Select "tree" type, click on map, tree point is placed with default canopyRadius
- Happy path: Select "water" type, draw polygon, water feature saved with correct featureType
- Happy path: Select building, draw polygon, set height in inspector, value persists
- Edge case: Switch from Polygon draw mode to Point draw mode mid-session
- Integration: Draw a tree point, save, reload — tree appears in feature list and on map

**Verification:**
- All new feature types can be drawn, selected, and have properties edited
- Feature list sidebar shows groups for each type
- Data round-trips through API correctly

---

- [ ] U10. **Layer visibility toggle**

**Goal:** Add toggle controls to show/hide each feature type layer independently in both editor and viewer.

**Requirements:** R5

**Dependencies:** U3, U9

**Files:**
- Modify: `components/viewer-v2.tsx`
- Modify: `components/editor-v2.tsx`

**Approach:**
- Add a `visibleLayers` state: `Record<FeatureType, boolean>`, all default to `true`
- Viewer: filter rendered groups by visibility before adding to scene, or toggle `visible` property on render groups
- Editor: filter OpenLayers features by visibility using a layer-per-type approach, or use style function that returns null for hidden types
- UI: small toggleable layer chips/buttons in the viewer toolbar and editor sidebar
- Persist visibility state in URL query params or local state (no API persistence needed)

**Patterns to follow:**
- Existing `showParcels` prop pattern in viewer

**Test scenarios:**
- Happy path: Toggling "water" off hides all water bodies, toggling back shows them
- Happy path: Toggling "parcel" off hides parcels but roads/trees remain visible
- Edge case: All layers toggled off shows empty terrain
- Integration: Visibility state in editor matches expected behavior (hidden features cannot be selected)

**Verification:**
- Each feature type can be independently shown/hidden
- Toggle state is visually reflected immediately

---

## System-Wide Impact

- **API surface:** `isParcelFeature()` validator must accept Point geometry. Existing clients sending only Polygon/LineString features are unaffected.
- **Data model:** New optional properties (`canopyRadius`, `height`, `floors`) on ParcelProperties. All optional — no migration needed for existing data.
- **Viewer rendering:** ParcelLayer refactored from monolithic to per-type dispatch. Existing parcel rendering behavior preserved by design.
- **Editor interactions:** New Point draw mode added alongside existing Polygon and LineString. No changes to existing draw behavior.
- **Unchanged invariants:** Parcel status colors, badge system, hover/selection, animated camera, Chaikin smoothing — all unchanged.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Water2 reflection on curved surface looks wrong | Use `getObjectFrame()` for orientation; gate reflections behind distance check; fall back to simple tinted material if visual quality insufficient |
| Fan triangulation replacement breaks existing parcels | U2 explicitly verifies existing parcels render identically before proceeding |
| Ribbon mesh miter produces visual artifacts at sharp turns | Clamp miter length at 4x half-width; visually test with sharp-angled road segments |
| InstancedMesh billboard matrices cause frame drops with many trees | CPU matrix update is ~0.1ms for 500 instances; if needed, batch updates every 2 frames |
| `depthTest: true` causes parcels to disappear behind terrain | Keep existing parcels at `depthTest: false` (proven pattern); only new infrastructure layers use `depthTest: true` |
| Tree texture quality at close zoom | Start with a single high-quality PNG; iterate on texture atlas later |

---

## Sources & References

- **Origin document:** [docs/brainstorms/infrastructure-layers-requirements.md](docs/brainstorms/infrastructure-layers-requirements.md)
- Related code: `lib/parcels.ts`, `components/viewer-v2.tsx`, `components/editor-v2.tsx`
- Three.js Water2: `three/examples/jsm/objects/Water2`
- Three.js Earcut: built-in `THREE.Earcut.triangulate`
- Three.js ExtrudeGeometry: built-in with Shape + earcut
- Codex session: `019dc142-b745-7331-b7e9-5f0d157ab19e`
