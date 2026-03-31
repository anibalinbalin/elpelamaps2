# Shadow Handoff

Date: 2026-03-30
Branch: `anibal/phase1-viewer`

## Current state

- Keep commit `8d804c1`:
  `fix: apply sun response shading during daytime scrubbing`
- Keep commit `bb6ee0b`:
  `Revert "feat: add screen-space sun shadow projection"`
- The branch should not contain any local shadow WIP beyond those committed changes.
- The public viewer currently has:
  - working sun/time scrubber
  - working sky/atmosphere time changes via Cesium clock
  - working facade/day-night response in the custom tile shader
  - no believable projected shadows yet

## What we tried and what failed

### 1. Cesium built-in shadow maps on Google Photorealistic 3D Tiles

Status: failed

Reason:
- Google Photorealistic 3D Tiles are effectively on an `UNLIT` path for this setup.
- `viewer.shadows = true` and `tileset.shadows = ENABLED` did not produce real shadows.
- Internal note already recorded this in:
  [2026-03-30-shadow-map-probe-result.md](/Users/anibalin/Sites/2026/elpela2/docs/superpowers/notes/2026-03-30-shadow-map-probe-result.md)

Conclusion:
- Do not spend more time trying to force Cesium's built-in shadows on the current Google tile path.

### 2. Screen-space shadow projection

Status: failed

Commit:
- `3324b4f` `feat: add screen-space sun shadow projection`

Outcome:
- Produced artifacts, especially visible on sand/beach areas.
- Did not create believable parcel-area shadows.
- Reverted by `bb6ee0b`.

Conclusion:
- Do not retry screen-space shadow hacks for this viewer.

### 3. Atlas/canopy occluder shader experiment

Status: not kept

What was attempted:
- Use the existing `data/living-world-mask.png` canopy channel as an occluder atlas.
- Sample it in `lib/night-mode.ts` and project shadows in texture space from the sun direction.

Outcome:
- The code bundled, but the result was not verified as a believable improvement.
- It was not committed or pushed.
- That local WIP has been discarded so the repo is clean.

Conclusion:
- If retrying an atlas approach, do it deliberately with debug visualization and better ground/base-height data.

## Recommended next direction

Recommendation: **Option 2**

Meaning:
- Keep the current Cesium public viewer.
- Do not try to shadow the entire Google photoreal city.
- Add a **scoped parcel-area shadow overlay** using simplified occluders near the parcels only.

Why this is the best tradeoff:
- keeps the current viewer architecture
- avoids the Cesium/Google `UNLIT` dead end
- is much smaller than migrating the whole public viewer to the separate Three.js tiles stack
- focuses on the only area buyers care about: the parcels and their immediate surroundings

## What the next Codex session should build

Implement a **parcel-area shadow overlay** in the Cesium public viewer, not a full-scene shadow system.

Target behavior:
- Shadows only need to read well around the parcels.
- Use simplified occluders:
  - tree masses
  - building masses
  - optionally only inside a bounded study rectangle around the parcels
- The overlay should update from the existing sun arc state.
- The goal is convincing directional parcel-area shadows, not physically perfect city-wide shadows.

Suggested implementation shape:
- Add a bounded "shadow study area" around the parcels.
- Create simplified occluder geometry or shadow primitives for that area only.
- Project or render those shadows onto nearby ground/parcel surfaces.
- Keep the current facade shading in `lib/night-mode.ts`; treat the overlay as a separate system.

Important constraints:
- Do not retry Cesium built-in shadows on the Google tiles.
- Do not retry screen-space post-process shadows.
- Do not hide weak results behind subtle tuning; the effect should read from the default camera.

## If the next session wants to pivot instead

Alternative path:
- Migrate the sun-shadow feature to the Three.js / `3d-tiles-renderer` path for real shadow maps.

Use this only if the requirement becomes:
- real mesh shadows are non-negotiable
- shadow correctness matters more than staying on the current Cesium public viewer

## Quick instruction for the next session

Tell the next Codex session:

> Read [2026-03-30-shadow-handoff.md](/Users/anibalin/Sites/2026/elpela2/docs/superpowers/notes/2026-03-30-shadow-handoff.md) and implement the recommended Option 2 parcel-area shadow overlay in the Cesium public viewer. Do not retry built-in Cesium shadows or screen-space shadow hacks.
