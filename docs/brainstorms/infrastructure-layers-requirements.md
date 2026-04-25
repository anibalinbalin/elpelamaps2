# Infrastructure Layers for Master Plan Visualization

**Date:** 2026-04-24
**Status:** Ready for planning
**Scope:** Standard

## Problem

The viewer currently renders only parcel polygons on the 3D globe. Roads and amenities exist in the data model but are not rendered in the viewer. Real estate clients expect to see a complete master plan — water features, trees, roads, green spaces, buildings — not just lot boundaries. The reference is the AURA master plan (Punta del Este), which uses lagunas, scattered trees, internal roads, a club house, and green spaces to sell the vision of the development.

## Goal

Render photorealistic 3D infrastructure elements on the globe viewer alongside parcels: water bodies, trees, roads, building footprints, and green spaces. The viewer should feel like looking at a real place, not a wireframe subdivision.

## Decisions Made

- **Visual style:** Photorealistic 3D objects on Google Photorealistic 3D Tiles (not illustrated overlay)
- **Water rendering:** Three.js Water2 shader with subtle ripple animation, sky/terrain reflection, blue-green tint
- **Trees:** Billboard sprites (camera-facing quads with tree texture), instanced for performance (500+ trees in one draw call)
- **Context POIs:** Deferred (nearby landmarks with distance labels — add later)
- **Section grouping:** Deferred (lettered section badges — not in first push)
- **Cinematic reveal:** Deferred (layer-by-layer animated fly-in — separate follow-up effort)

## Requirements

### R1: Expand FeatureType system

Extend `FeatureType` in `lib/parcels.ts` to support new infrastructure categories:

- `water` — Polygon geometry for lagunas, ponds, retention basins
- `greenspace` — Polygon geometry for parks, open areas, landscaped zones
- `tree` — Point geometry for individual tree placements (new geometry type)
- `building` — Polygon geometry for building footprints with height/floors property
- `sidewalk` — LineString geometry for pedestrian paths (like roads but narrower, different material)

Roads and amenities remain as-is.

### R2: Viewer renders all feature types

The viewer currently assumes all features are parcel polygons. Refactor to dispatch rendering by `featureType`:

- **Parcels:** Existing polygon + fill + badge rendering (unchanged)
- **Roads:** LineString rendered as a ribbon mesh with width in meters (not pixels), light grey asphalt material
- **Water:** Polygon rendered as a Water2 shader plane — animated ripples, reflective surface, blue-green tint. Positioned slightly above terrain to avoid z-fighting.
- **Green spaces:** Polygon rendered as a subtle green-tinted ground plane, softer than parcel boundaries
- **Trees:** Points rendered as instanced billboard sprites. Camera-facing quads with tree texture, varying size by a `canopyRadius` property. One `InstancedMesh` draw call for all trees.
- **Buildings:** Polygon rendered as extruded geometry using a `height` or `floors` property. Neutral material with subtle shadow.
- **Sidewalks:** LineString rendered as a thin ribbon mesh, cream/light material, distinct from road surface.

### R3: Editor supports new feature types

The editor needs to support drawing and editing each new type:

- **Point geometry support** — new draw mode for trees (single-click placement)
- **Feature type selector** expanded with new types
- **Per-type property inspector:**
  - Water: name
  - Green space: name
  - Tree: name, canopyRadius (meters)
  - Building: name, height (meters) or floors (integer)
  - Sidewalk: name, width (meters)

### R4: Per-type styling in editor

Each feature type gets a distinct fill/stroke style in the OpenLayers editor:

- Water: blue-green translucent fill
- Green space: soft green fill
- Tree: small green circle marker
- Building: neutral gray fill
- Sidewalk: cream/tan thin line

### R5: Layer visibility toggle

Both editor and viewer should support toggling visibility of each feature type layer independently. Lets clients focus on specific aspects (just parcels, or parcels + roads + water, etc.).

## Non-Goals

- Animated cinematic reveal sequence (deferred, separate effort)
- Surrounding context POI labels with drive times (deferred)
- Section/neighborhood grouping badges (deferred)
- Illustrated/stylized rendering — this is photorealistic only
- Utility corridors, street lighting, signage (nice-to-have, not in first push)
- Procedural tree/vegetation placement — trees are manually placed via editor

## Success Criteria

1. Viewer renders water bodies with animated reflective shader
2. Viewer renders 100+ instanced tree sprites without frame drop
3. Viewer renders building footprints as extruded 3D geometry
4. Viewer renders roads and sidewalks as ribbon meshes with correct width
5. Editor supports drawing all new feature types including Point geometry
6. Layer toggle works in both editor and viewer
7. A master plan with lagunas, trees, roads, parcels, and buildings looks like a real subdivision when viewed on the 3D globe

## Technical Risks

- **Water shader on curved globe surface:** Water2 expects a flat plane. May need adaptation for Cesium ellipsoid positioning.
- **Tree billboard orientation:** Sprites need to face camera while staying oriented to globe surface normal, not world up.
- **Road ribbon mesh generation:** Converting LineString + width into a proper mesh with mitered corners is non-trivial. Consider existing Three.js mesh line libraries.
- **Concave polygon triangulation:** Water bodies and irregular green spaces may be concave. Current fan triangulation may break — use earcut.
- **Z-fighting:** Multiple layers at ground level (road, sidewalk, parcel, green space) need careful depth offset management.

## Reference

- AURA master plan (Punta del Este) — visual reference for target output
- Codex session `019dc142-b745-7331-b7e9-5f0d157ab19e` — technical analysis
