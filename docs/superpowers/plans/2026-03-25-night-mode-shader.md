# Night Mode Shader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a night mode toggle to the Cesium public viewer that transforms the daytime 3D tiles into a nighttime scene using a GLSL post-processing shader — dark terrain, glowing building windows, starfield sky.

**Architecture:** A Cesium `PostProcessStage` fragment shader applied to the scene's framebuffer. The shader darkens the scene, detects bright pixels (buildings/windows) via luminance+saturation heuristics, adds warm glow to detected lights, and composites a procedural starfield in the sky region. A React state toggle (`isNightMode`) controls adding/removing the stage. A moon/sun icon button in the TopBar toolbar triggers the toggle.

**Tech Stack:** CesiumJS PostProcessStage (GLSL ES 1.0), React state, Huge Icons

**Design doc:** `~/.gstack/projects/anibalinbalin-elpelamaps2/anibalin-anibal-phase1-viewer-design-20260325-094732.md`

**Design decision:** The spec recommended Approach C (staged: Black Marble first, then shader). After the CSS filter prototype validated the concept and revealed that buildings naturally stand out via brightness heuristics alone, we're going straight to Approach B (shader). The Black Marble data at ~500m/pixel is too coarse for parcel-level zoom, and our CSS test proved the shader approach works without it.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `lib/night-mode-shader.ts` | Create | GLSL fragment shader source + PostProcessStage factory |
| `components/cesium-public-viewer.tsx` | Modify | Wire night mode state, add/remove PostProcessStage |
| `components/top-bar.tsx` | Modify | Add night mode toggle button |

---

### Task 1: Create the Night Mode GLSL Shader

**Files:**
- Create: `lib/night-mode-shader.ts`

- [ ] **Step 1: Create the shader module**

Create `lib/night-mode-shader.ts` with the GLSL fragment shader and a factory function that returns a Cesium `PostProcessStage`.

```typescript
import { PostProcessStage } from "cesium";

/**
 * GLSL fragment shader for night mode.
 *
 * Pipeline:
 * 1. Read the scene color from the framebuffer
 * 2. Compute luminance and saturation
 * 3. Detect "light source" pixels: high luminance + low saturation + red > blue (rejects water/sky)
 * 4. Darken the base scene with blue moonlight tint
 * 5. Add warm glow to detected light pixels
 * 6. Composite procedural starfield in sky region (top of screen, where scene is very dark)
 */
const NIGHT_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D colorTexture;
  in vec2 v_textureCoordinates;

  // --- Tuning knobs (compile-time constants — edit and rebuild to adjust) ---
  const float DARKEN = 0.12;            // base scene brightness multiplier
  const float LUMINANCE_THRESH = 0.55;  // min luminance to be a candidate light
  const float SATURATION_MAX = 0.35;    // max saturation for candidate lights
  const float GLOW_INTENSITY = 1.8;     // glow brightness multiplier
  const float STAR_DENSITY = 800.0;     // star count factor
  const float SKY_THRESHOLD = 0.04;     // luminance below which we draw stars

  // Warm window glow color (~3200K incandescent)
  const vec3 WARM_GLOW = vec3(1.0, 0.82, 0.55);
  // Cool moonlight ambient tint (~8000K)
  const vec3 MOON_TINT = vec3(0.7, 0.78, 1.0);

  float luminance(vec3 c) {
    return dot(c, vec3(0.2126, 0.7152, 0.0722));
  }

  float saturation(vec3 c) {
    float mn = min(min(c.r, c.g), c.b);
    float mx = max(max(c.r, c.g), c.b);
    return mx > 0.001 ? (mx - mn) / mx : 0.0;
  }

  // Simple hash for procedural stars
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    vec4 sceneColor = texture(colorTexture, v_textureCoordinates);
    vec3 color = sceneColor.rgb;

    float lum = luminance(color);
    float sat = saturation(color);

    // --- Light detection ---
    // Candidate: bright, low-saturation, and red >= blue (rejects water/sky reflections)
    bool isLight = lum > LUMINANCE_THRESH
                && sat < SATURATION_MAX
                && color.r >= color.b * 0.85;

    // --- Darken the scene with moonlight tint ---
    vec3 nightBase = color * DARKEN * MOON_TINT;

    // --- Add warm glow to detected lights ---
    if (isLight) {
      float glowStrength = smoothstep(LUMINANCE_THRESH, 1.0, lum) * GLOW_INTENSITY;
      nightBase += WARM_GLOW * glowStrength * color;
    }

    // --- Procedural starfield in dark sky regions ---
    float sceneLum = luminance(nightBase);
    if (sceneLum < SKY_THRESHOLD && v_textureCoordinates.y > 0.3) {
      vec2 starUV = v_textureCoordinates * STAR_DENSITY;
      vec2 starCell = floor(starUV);
      float starVal = hash(starCell);

      if (starVal > 0.985) {
        // Star brightness varies
        float brightness = (starVal - 0.985) / 0.015;
        // Slight twinkle based on position
        float twinkle = 0.7 + 0.3 * sin(starCell.x * 12.9898 + starCell.y * 78.233);
        // Stars fade near horizon
        float horizonFade = smoothstep(0.3, 0.55, v_textureCoordinates.y);
        nightBase += vec3(brightness * twinkle * horizonFade * 0.9);
      }
    }

    out_FragColor = vec4(nightBase, sceneColor.a);
  }
`;

/**
 * Creates a Cesium PostProcessStage for night mode rendering.
 * Add to viewer.postProcessStages, remove to disable.
 */
export function createNightModeStage(): PostProcessStage {
  return new PostProcessStage({
    name: "nightMode",
    fragmentShader: NIGHT_FRAGMENT_SHADER,
  });
}
```

- [ ] **Step 2: Verify the module compiles**

Run: `npx tsc --noEmit lib/night-mode-shader.ts`
Expected: No type errors. If `PostProcessStage` import fails, check cesium types are available.

- [ ] **Step 3: Commit**

```bash
git add lib/night-mode-shader.ts
git commit -m "feat: add night mode GLSL post-processing shader"
```

---

### Task 2: Wire Night Mode into the Cesium Public Viewer

**Files:**
- Modify: `components/cesium-public-viewer.tsx`

- [ ] **Step 1: Add night mode state and import**

At the top of `cesium-public-viewer.tsx`, add the import:

```typescript
import { createNightModeStage } from "@/lib/night-mode-shader";
```

In the `CesiumPublicViewer` component, add state and ref after the existing refs:

```typescript
const [isNightMode, setIsNightMode] = useState(false);
const nightStageRef = useRef<PostProcessStage | null>(null);
```

Add `PostProcessStage` to the cesium import at the top of the file (add after `PolygonHierarchy`):

```typescript
import {
  // ... existing imports ...
  PostProcessStage,
  // ... rest of existing imports ...
} from "cesium";
```

- [ ] **Step 2: Add useEffect to toggle the shader**

After the existing `useEffect` blocks (but before the return statement), add:

```typescript
useEffect(() => {
  const viewer = viewerRef.current;
  if (!viewer || viewer.isDestroyed()) return;

  if (isNightMode) {
    // Add night shader
    if (!nightStageRef.current) {
      nightStageRef.current = createNightModeStage();
    }
    if (!viewer.postProcessStages.contains(nightStageRef.current)) {
      viewer.postProcessStages.add(nightStageRef.current);
    }
    // Hide daytime sky atmosphere
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.show = false;
    }
    viewer.scene.backgroundColor = Color.BLACK;
  } else {
    // Remove night shader
    if (nightStageRef.current && viewer.postProcessStages.contains(nightStageRef.current)) {
      viewer.postProcessStages.remove(nightStageRef.current);
    }
    // Restore daytime sky
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.show = true;
    }
    viewer.scene.backgroundColor = Color.BLACK;
  }
}, [isNightMode]);
```

- [ ] **Step 3: Clean up night stage on unmount**

In the existing cleanup/dispose logic (the `return () => { ... }` inside the main useEffect), add:

```typescript
if (nightStageRef.current) {
  try {
    viewer.postProcessStages.remove(nightStageRef.current);
  } catch (_) {}
  nightStageRef.current = null;
}
```

- [ ] **Step 4: Pass night mode state to TopBar**

Update the `<TopBar>` JSX to pass night mode props:

```tsx
<TopBar
  drawMode={false}
  parcelCount={parcels.features.length}
  cloudSwooshTick={cloudSwooshTick}
  cloudsCleared={cloudsCleared}
  isCloudSwooshing={isCloudSwooshing}
  onSwooshClouds={handleCloudSwoosh}
  isNightMode={isNightMode}
  onToggleNightMode={() => setIsNightMode((v) => !v)}
/>
```

- [ ] **Step 5: Commit**

```bash
git add components/cesium-public-viewer.tsx
git commit -m "feat: wire night mode PostProcessStage into Cesium viewer"
```

---

### Task 3: Add Night Mode Toggle Button to TopBar

**Files:**
- Modify: `components/top-bar.tsx`

- [ ] **Step 1: Add night mode props to TopBarProps**

```typescript
interface TopBarProps {
  drawMode: boolean;
  parcelCount: number;
  cloudSwooshTick: number;
  cloudsCleared: boolean;
  isCloudSwooshing: boolean;
  onSwooshClouds: () => void;
  isNightMode?: boolean;
  onToggleNightMode?: () => void;
}
```

Destructure the new props in the `TopBar` function.

- [ ] **Step 2: Import the moon/sun icons**

```typescript
import { Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons";
```

(Check available icons with `grep -r "Moon" node_modules/@hugeicons/core-free-icons/src/ | head -5` — use whatever moon icon is available.)

- [ ] **Step 3: Add the NightModeButton after CloudSwooshButton**

In the TopBar JSX, after the `<CloudSwooshButton>` and its preceding separator, add another separator and the night mode button:

```tsx
{onToggleNightMode && (
  <>
    <div className="mx-1 h-8 w-px bg-white/10" />
    <button
      type="button"
      onClick={onToggleNightMode}
      aria-label={isNightMode ? "Switch to day" : "Switch to night"}
      title={isNightMode ? "Switch to day" : "Switch to night"}
      className={`group relative flex h-11 w-11 items-center justify-center rounded-[18px] border text-white/72 shadow-[0_10px_24px_rgba(7,18,28,0.14),inset_0_1px_0_rgba(255,255,255,0.08)] transition-[transform,border-color,background-color,color,box-shadow] duration-300 active:scale-[0.985] ${
        isNightMode
          ? "border-amber-400/30 bg-[rgba(255,200,60,0.12)] text-amber-200/90 shadow-[0_12px_28px_rgba(7,18,28,0.16),inset_0_1px_0_rgba(255,255,255,0.1)]"
          : "border-white/8 bg-[rgba(255,255,255,0.025)] hover:-translate-y-px hover:border-white/14 hover:bg-[rgba(255,255,255,0.045)] hover:text-white/88 hover:shadow-[0_12px_28px_rgba(7,18,28,0.18),inset_0_1px_0_rgba(255,255,255,0.1)]"
      }`}
    >
      <span
        className={`pointer-events-none absolute inset-[5px] rounded-[14px] bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.12),rgba(255,255,255,0)_68%)] transition-opacity duration-300 ${
          isNightMode
            ? "opacity-100"
            : "opacity-[0.45] group-hover:opacity-[0.8]"
        }`}
      />
      <HugeiconsIcon
        icon={isNightMode ? Sun03Icon : Moon02Icon}
        size={18}
        strokeWidth={1.6}
        color="currentColor"
      />
    </button>
  </>
)}
```

- [ ] **Step 4: Test locally**

Run: `npx next dev --port 3001`
Navigate to `http://localhost:3001/viewer`
Click the moon icon — scene should darken with glowing building lights and stars.
Click the sun icon — scene returns to daytime.

- [ ] **Step 5: Commit**

```bash
git add components/top-bar.tsx
git commit -m "feat: add night/day toggle button to viewer toolbar"
```

---

### Task 4: Tune and Polish

**Files:**
- Modify: `lib/night-mode-shader.ts` (if shader values need adjustment)
- Modify: `components/cesium-public-viewer.tsx` (if atmosphere/overlay adjustments needed)

- [ ] **Step 1: Visual tuning on the live viewer**

Load the viewer at José Ignacio. Toggle night mode. Check:
- Are buildings/houses visible as glowing warm spots?
- Is the ocean/beach dark (not falsely glowing)?
- Are stars visible in the sky portion?
- Are parcel pills/labels legible against dark background?
- Does the transition feel smooth?

Adjust shader constants if needed:
- `DARKEN`: increase if too dark (try 0.15-0.20), decrease if too bright
- `LUMINANCE_THRESH`: lower if buildings aren't lighting up (try 0.45), raise if too many false positives
- `SATURATION_MAX`: raise if windows aren't detected (try 0.4)
- `GLOW_INTENSITY`: increase for more dramatic glow (try 2.5)

- [ ] **Step 2: Adjust parcel overlay contrast for night mode**

If parcel pills/labels are hard to read, the overlay components may need slight contrast adjustment. Check `ParcelPillsOverlay` and `ParcelSidebar` — they should be fine since they already use semi-transparent dark backgrounds, but verify visually.

- [ ] **Step 3: Hide the atmospheric wash overlay in night mode**

The `VignetteOverlay` component renders daytime atmospheric effects. In `cesium-public-viewer.tsx`, conditionally hide it:

The `VignetteOverlay` component accepts no props, so conditionally render it:

```tsx
{!isNightMode && <VignetteOverlay />}
```

Also conditionally render the `CloudVeilOverlay` the same way — daytime-only effects should not appear in night mode.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: tune night mode shader values and polish overlays"
```

---

### Task 5: Deploy and Verify

- [ ] **Step 1: Push to remote**

```bash
git push origin anibal/phase1-viewer
```

- [ ] **Step 2: Wait for Vercel deploy**

Monitor with `vercel ls` — wait for the new production deploy to be Ready.

- [ ] **Step 3: Verify on production**

Navigate to https://mapsmaps.vercel.app/viewer
- Toggle night mode on/off
- Verify the shader renders correctly
- Verify parcel overlays remain functional
- Screenshot for evidence

- [ ] **Step 4: Update memory**

Update the night mode memory note with the final shader values and deployment status.
