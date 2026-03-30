# Sun Arc Drawer — Design Spec
**Date:** 2026-03-30
**Status:** Approved

---

## Overview

A bottom-center drawer with an arc SVG that lets users scrub through the time of day (6am → midnight). The sun ball tracks its position on the arc and morphs into a crescent moon past dusk. The 3D scene reacts via shader-driven lighting: surface normal modulation, color temperature grading, and (optionally) Cesium shadow maps.

Audience: public viewer users (clients/buyers previewing parcels at different times of day).

---

## Trigger & Placement

- A new ☀ icon button added to the top bar, to the right of the existing 🌙 night mode button
- Same button style: `rounded-[16px] border border-white/8 bg-[rgba(255,255,255,0.025)]`
- Active state: `border-amber-400/30 bg-[rgba(255,180,30,0.12)] text-amber-200/90`
- Toggling the button slides the drawer up from the bottom center (`fixed inset-x-0 bottom-12 flex justify-center`)
- Drawer is dismissible by clicking the ☀ button again

**Interaction with night mode:**
- When arc is dragged past dusk threshold (~t ≥ 0.85), night mode activates automatically
- When dragged back into day, night mode deactivates
- The 🌙 toggle continues to work independently (manual override)
- Both active simultaneously shows the night shader at whatever time is set

---

## Arc Drawer Component

**File:** `components/sun-arc-drawer.tsx`

**Visual:**
- Dark glass panel: `bg-[rgba(16,20,25,0.93)] border-white/9 rounded-[20px] backdrop-blur-[28px]`
- Width: `calc(100% - 24px)`, max-width `360px`, centered
- Height: compact — time label row (~20px) + SVG arc (~58px) = ~90px total

**Arc SVG:**
- Quadratic bezier: `M 12,53 Q 164,-14 316,53` (viewBox `0 0 328 58`)
- Gradient from left to right: dawn-navy → orange → noon-yellow → dusk-red → night-navy
- Ghost arc underneath at low opacity for full-range context
- Horizon line at y=53
- Time tick labels: `6am` (left), `12pm` (apex), `12am` (right) — `font-size 6.5`, `rgba(255,255,255,0.2)`

**Sun ball:**
- Position computed from parametric `t` (0–1) on the bezier via the standard quadratic formula
- Rendered as SVG `<circle>` with radial gradient and glow filter
- Past t ≈ 0.85 (dusk), transitions to crescent moon: a second offset circle clips the ball

**Time label:**
- Sits above the arc: `font-size 13px font-weight 600 letter-spacing -0.02em`
- Computed via `new Date()` with hours set from `t` mapped to 6am–midnight range
- Formatted with `toLocaleTimeString()` (no seconds)

**Drag interaction:**
- `onPointerDown/Move/Up` on the SVG element
- `clientX` relative to SVG bounding rect → clamped `t` value (0–1)
- `pointer-events: none` on all child elements, `cursor: ew-resize` on the SVG
- `"drag arc"` hint text beside time label, fades out after first interaction (`opacity-0 transition-opacity`)

---

## `lib/sun-position.ts`

Single exported function:

```ts
export function timeToSunAngles(t: number): {
  azimuth: number;    // degrees 0–360
  elevation: number;  // degrees 0–90 (negative = below horizon)
  isNight: boolean;   // t >= 0.85
  blend: number;      // 0 = full day, 1 = full night (for u_timeOfDay)
  colorTemp: { r: number; g: number; b: number }; // tint values
}
```

- `t` maps: 0 = 6am, 0.5 = noon, ~0.75 = 6pm, 1.0 = midnight
- Sun elevation peaks at t=0.5 (~75° for José Ignacio in summer), 0° at t≈0.25 (sunrise) and t≈0.75 (sunset)
- Azimuth sweeps from east (~90°) at sunrise through north (~0°) at noon to west (~270°) at sunset
- `colorTemp` returns interpolated tint values across 4 keyframes:
  - Dawn/dusk: `{ r: 0.9, g: 0.4, b: 0.1 }`
  - Midday: `{ r: 1.0, g: 0.95, b: 0.85 }`
  - Night: `{ r: 0.04, g: 0.11, b: 0.68 }` (existing values)

---

## Shader changes — `lib/night-mode.ts`

### Phase 1: Surface Normal Lighting (ship first)

New uniforms added to `NIGHT_FRAGMENT`:

```glsl
uniform float u_sunAzimuth;    // radians
uniform float u_sunElevation;  // radians
uniform float u_timeOfDay;     // 0 = day, 1 = night
uniform float u_shadowDark;    // how dark the shadow side gets (default 0.55)
```

Shader logic added before the composite step:

```glsl
// Sun direction from azimuth + elevation
vec3 sunDir = vec3(
  cos(u_sunElevation) * sin(u_sunAzimuth),
  cos(u_sunElevation) * cos(u_sunAzimuth),
  sin(u_sunElevation)
);
vec3 normal = normalize(fsInput.attributes.normalEC);  // tile mesh normal
float NdotL = max(dot(normal, sunDir), 0.0);
float shadowFactor = mix(u_shadowDark, 1.0, NdotL);

// Apply to nightColor (not glow)
nightColor *= mix(shadowFactor, 1.0, u_timeOfDay); // shadow only on day side
```

Color temperature replaces hard-coded tint:
```glsl
// u_tintR/G/B are already interpolated by the React side before setUniform
vec3 tint = vec3(u_tintR, u_tintG, u_tintB);
```

The React side calls `setUniform()` for `u_tintR/G/B`, `u_sunAzimuth`, `u_sunElevation`, and `u_timeOfDay` on every arc drag event.

### Phase 2: Cesium Shadow Maps (test separately)

- Set `viewer.shadows = true` when `elevation > 10°` (daytime only)
- Verify shadow maps render on Google tiles with `LightingModel.UNLIT`
- If confirmed: cast real building-to-ground shadows
- If incompatible: skip, Phase 1 is sufficient

### Phase 3: Cesium Clock Sky (if Phase 2 works)

- Compute a `JulianDate` for José Ignacio's timezone from the arc `t` value
- Assign to `viewer.clock.currentTime`
- Cesium sun disc and atmosphere update automatically
- No additional shader changes needed

---

## Wiring — `cesium-public-viewer.tsx`

```tsx
const [sunTime, setSunTime] = useState(0.5); // default: noon
const [sunDrawerOpen, setSunDrawerOpen] = useState(false);

// On arc drag:
const handleSunTime = useCallback((t: number) => {
  setSunTime(t);
  const { azimuth, elevation, isNight, blend, colorTemp } = timeToSunAngles(t);
  NIGHT_SHADER.setUniform('u_sunAzimuth', azimuth * DEG2RAD);
  NIGHT_SHADER.setUniform('u_sunElevation', elevation * DEG2RAD);
  NIGHT_SHADER.setUniform('u_timeOfDay', blend);
  NIGHT_SHADER.setUniform('u_tintR', colorTemp.r);
  NIGHT_SHADER.setUniform('u_tintG', colorTemp.g);
  NIGHT_SHADER.setUniform('u_tintB', colorTemp.b);
  if (isNight && !isNightMode) applyNightMode(...);
  if (!isNight && isNightMode) cleanupNightMode();
}, [isNightMode]);
```

---

## Component structure summary

| File | Change |
|---|---|
| `components/sun-arc-drawer.tsx` | New — arc SVG, drag logic, time label |
| `lib/sun-position.ts` | New — `timeToSunAngles()` |
| `lib/night-mode.ts` | Add 4 new uniforms + shadow N·L logic to fragment shader |
| `components/top-bar.tsx` | Add ☀ button, `onSunToggle` prop |
| `components/cesium-public-viewer.tsx` | Wire sun state → uniforms, render `SunArcDrawer` |

---

## Out of scope

- Animation playback (auto-advancing the sun) — manual scrub only
- Per-parcel sun exposure analysis
- Mobile swipe gesture for the arc (standard drag works on touch)
- Saving preferred time of day

---

## Success criteria

- Dragging the arc changes the scene lighting visibly in real-time
- Building faces pointing toward the sun are lighter than faces pointing away
- Scene transitions smoothly from warm daytime → orange dusk → blue night
- Night mode window glow activates automatically past dusk
- Drawer does not overlap or conflict with the parcel drawer (bottom-right)
