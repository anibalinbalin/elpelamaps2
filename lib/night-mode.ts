import {
  Cesium3DTileStyle,
  Color,
  CustomShader,
  CustomShaderMode,
  LightingModel,
  TextureUniform,
  UniformType,
  type Viewer,
} from "cesium";

// --- Mask bounding box (José Ignacio area) ---
export const MASK_SIZE = 1024;

/** Lon/lat bounds for the 2D editor and shader (degrees) */
export const MASK_BOUNDS_LON_LAT = {
  sw: [-54.70, -34.86] as [number, number],
  ne: [-54.58, -34.79] as [number, number],
};

const DEG2RAD = Math.PI / 180;

/**
 * Sun + night response via CustomShader on Google Photorealistic 3D Tiles.
 *
 * Uses MODIFY_MATERIAL so material.diffuse contains the actual baked tile
 * texture. In daytime it approximates facade response with a wrapped N·L term
 * and time-of-day tinting. At night it falls back to the existing moonlit
 * treatment and warm window glow. Ocean/waves are masked dark only in night.
 *
 * Exclusion zones use a painted mask texture instead of fixed circles.
 */

const NIGHT_FRAGMENT = /* glsl */ `
  void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
    vec3 original = material.diffuse;
    float luminance = dot(original, vec3(0.2126, 0.7152, 0.0722));

    // --- Shared tint from the current sun state ---
    vec3 tint = vec3(u_tintR, u_tintG, u_tintB);

    // --- Ocean/wave masking ---
    float blueRatio = original.b / (luminance + 0.001);
    float maxC = max(original.r, max(original.g, original.b));
    float minC = min(original.r, min(original.g, original.b));
    float saturation = (maxC > 0.001) ? (maxC - minC) / maxC : 0.0;
    float isWater = smoothstep(u_waterBlueMin, u_waterBlueMax, blueRatio)
                  * smoothstep(u_waterSatMin, u_waterSatMax, saturation);
    // --- Directional sun response ---
    // Convert sun azimuth/elevation to a direction vector in world space,
    // then rotate into eye space so it matches normalEC (eye-space normal).
    vec3 sunDirWorld = vec3(
      cos(u_sunElevation) * sin(u_sunAzimuth),
      cos(u_sunElevation) * cos(u_sunAzimuth),
      sin(u_sunElevation)
    );
    vec3 sunDirEC = normalize(mat3(czm_view) * sunDirWorld);
    vec3 normalEC = normalize(fsInput.attributes.normalEC);
    float wrappedNdotL = clamp(
      (dot(normalEC, sunDirEC) + u_sunWrap) / (1.0 + u_sunWrap),
      0.0,
      1.0
    );
    float sunShade = mix(u_shadowDark, 1.0, wrappedNdotL);
    float dayShade = mix(1.0, max(sunShade, u_dayAmbient), u_dayStrength);

    // Keep the baked Google texture dominant; tint should feel like sunlight,
    // not a full recolor of the asset.
    vec3 dayTint = mix(vec3(1.0), tint, 0.28);
    vec3 dayColor = original * dayTint * dayShade;

    // --- Night branch ---
    vec3 nightColor = original * tint * u_tintBrightness;
    nightColor *= mix(1.0, u_waterDarken, isWater);

    // --- Window detection ---
    float lumScore = smoothstep(u_winLumMin, u_winLumMax, luminance);
    float satScore = 1.0 - smoothstep(u_winSatMin, u_winSatMax, saturation);
    float windowScore = lumScore * satScore;
    // Suppress window glow in daytime (fade in over the dusk/dawn transition band)
    float nightFactor = smoothstep(0.3, 0.7, u_timeOfDay);
    windowScore *= nightFactor;

    // --- Exclusion mask (texture-based) ---
    vec3 pos = fsInput.attributes.positionWC;
    float lon = atan(pos.y, pos.x);
    float p = sqrt(pos.x * pos.x + pos.y * pos.y);
    float lat = atan(pos.z, p * (1.0 - 0.00669438));
    vec2 maskUV = vec2(
      (lon - u_boundsMinLon) / (u_boundsMaxLon - u_boundsMinLon),
      (lat - u_boundsMinLat) / (u_boundsMaxLat - u_boundsMinLat)
    );
    maskUV.y = 1.0 - maskUV.y; // flip: canvas row 0 = north, but texImage2D row 0 = UV.y 0
    maskUV = clamp(maskUV, 0.0, 1.0);
    float maskVal = texture(u_maskTex, maskUV).r;
    windowScore *= (1.0 - maskVal);

    // --- Window glow ---
    vec3 glowColor = vec3(u_glowR, u_glowG, u_glowB);
    vec3 glow = glowColor * u_glowIntensity * luminance;

    // --- Composite ---
    vec3 nightResult = mix(nightColor, glow, windowScore);
    material.diffuse = mix(dayColor, nightResult, u_timeOfDay);
  }
`;

/**
 * Create a fresh sun-response shader instance.
 * When `maskPixels` is provided (RGBA Uint8Array, MASK_SIZE×MASK_SIZE),
 * the exclusion mask is baked directly into the initial texture — no
 * runtime `setUniform` needed (which Cesium may not honour on an
 * already-compiled CustomShader).
 */
export function createNightShader(maskPixels?: Uint8Array): CustomShader {
  const maskTex = maskPixels
    ? new TextureUniform({ typedArray: maskPixels, width: MASK_SIZE, height: MASK_SIZE })
    : new TextureUniform({ typedArray: new Uint8Array(MASK_SIZE * MASK_SIZE * 4), width: MASK_SIZE, height: MASK_SIZE });

  const shader = new CustomShader({
    mode: CustomShaderMode.MODIFY_MATERIAL,
    lightingModel: LightingModel.UNLIT,
    uniforms: {
      u_tintR: { type: UniformType.FLOAT, value: 0.040 },
      u_tintG: { type: UniformType.FLOAT, value: 0.110 },
      u_tintB: { type: UniformType.FLOAT, value: 0.680 },
      u_tintBrightness: { type: UniformType.FLOAT, value: 1.000 },
      u_waterBlueMin: { type: UniformType.FLOAT, value: 1.600 },
      u_waterBlueMax: { type: UniformType.FLOAT, value: 0.950 },
      u_waterSatMin: { type: UniformType.FLOAT, value: 0.070 },
      u_waterSatMax: { type: UniformType.FLOAT, value: 0.110 },
      u_waterDarken: { type: UniformType.FLOAT, value: 0.110 },
      u_winLumMin: { type: UniformType.FLOAT, value: 0.870 },
      u_winLumMax: { type: UniformType.FLOAT, value: 1.000 },
      u_winSatMin: { type: UniformType.FLOAT, value: 0.220 },
      u_winSatMax: { type: UniformType.FLOAT, value: 0.670 },
      u_glowR: { type: UniformType.FLOAT, value: 1.000 },
      u_glowG: { type: UniformType.FLOAT, value: 0.780 },
      u_glowB: { type: UniformType.FLOAT, value: 0.360 },
      u_glowIntensity: { type: UniformType.FLOAT, value: 1.500 },
      u_maskTex: { type: UniformType.SAMPLER_2D, value: maskTex },
      u_boundsMinLon: { type: UniformType.FLOAT, value: MASK_BOUNDS_LON_LAT.sw[0] * DEG2RAD },
      u_boundsMinLat: { type: UniformType.FLOAT, value: MASK_BOUNDS_LON_LAT.sw[1] * DEG2RAD },
      u_boundsMaxLon: { type: UniformType.FLOAT, value: MASK_BOUNDS_LON_LAT.ne[0] * DEG2RAD },
      u_boundsMaxLat: { type: UniformType.FLOAT, value: MASK_BOUNDS_LON_LAT.ne[1] * DEG2RAD },
      u_sunAzimuth:   { type: UniformType.FLOAT, value: 0.0 },    // radians, sun azimuth
      u_sunElevation: { type: UniformType.FLOAT, value: 1.309 },   // radians (~75° peak)
      u_timeOfDay:    { type: UniformType.FLOAT, value: 1.0 },     // 0=day, 1=night (default full-night until sun arc is used)
      u_dayStrength:  { type: UniformType.FLOAT, value: 0.92 },    // 0=no daytime modulation, 1=full facade response
      u_dayAmbient:   { type: UniformType.FLOAT, value: 0.70 },    // daylight floor for shadowed faces
      u_sunWrap:      { type: UniformType.FLOAT, value: 0.28 },    // soften the day/night terminator on facades
      u_shadowDark:   { type: UniformType.FLOAT, value: 0.55 },    // shadow face darkness
    },
    fragmentShaderText: NIGHT_FRAGMENT,
  });

  return shader;
}

/** The currently-active sun-response shader instance (updated by `createNightShader`). */
// eslint-disable-next-line import/no-mutable-exports
export let NIGHT_SHADER: CustomShader = createNightShader();

/**
 * Create a fresh sun-response shader and update the module-level reference.
 * Use this from consumer code (viewer, editor) so `NIGHT_SHADER` stays current.
 */
export function recreateNightShader(maskPixels?: Uint8Array): CustomShader {
  const shader = createNightShader(maskPixels);
  NIGHT_SHADER = shader;
  return shader;
}

/** Uniform metadata for the tuning panel */
export const NIGHT_UNIFORMS = [
  { key: "u_tintR", label: "Tint Red", min: 0, max: 1, step: 0.01, group: "Moonlit Tint" },
  { key: "u_tintG", label: "Tint Green", min: 0, max: 1, step: 0.01, group: "Moonlit Tint" },
  { key: "u_tintB", label: "Tint Blue", min: 0, max: 1, step: 0.01, group: "Moonlit Tint" },
  { key: "u_tintBrightness", label: "Brightness", min: 1, max: 15, step: 0.1, group: "Moonlit Tint" },
  { key: "u_waterBlueMin", label: "Blue Ratio Min", min: 0.5, max: 2, step: 0.05, group: "Ocean Mask" },
  { key: "u_waterBlueMax", label: "Blue Ratio Max", min: 0.5, max: 3, step: 0.05, group: "Ocean Mask" },
  { key: "u_waterSatMin", label: "Sat Min", min: 0, max: 0.5, step: 0.01, group: "Ocean Mask" },
  { key: "u_waterSatMax", label: "Sat Max", min: 0, max: 1, step: 0.01, group: "Ocean Mask" },
  { key: "u_waterDarken", label: "Darken Factor", min: 0, max: 1, step: 0.01, group: "Ocean Mask" },
  { key: "u_winLumMin", label: "Lum Min", min: 0.3, max: 1, step: 0.01, group: "Window Detection" },
  { key: "u_winLumMax", label: "Lum Max", min: 0.3, max: 1, step: 0.01, group: "Window Detection" },
  { key: "u_winSatMin", label: "Sat Min", min: 0, max: 1, step: 0.01, group: "Window Detection" },
  { key: "u_winSatMax", label: "Sat Max", min: 0, max: 1, step: 0.01, group: "Window Detection" },
  { key: "u_glowR", label: "Glow Red", min: 0, max: 1, step: 0.01, group: "Window Glow" },
  { key: "u_glowG", label: "Glow Green", min: 0, max: 1, step: 0.01, group: "Window Glow" },
  { key: "u_glowB", label: "Glow Blue", min: 0, max: 1, step: 0.01, group: "Window Glow" },
  { key: "u_glowIntensity", label: "Intensity", min: 0, max: 5, step: 0.1, group: "Window Glow" },
] as const;

/**
 * Apply night mode. Returns cleanup function.
 * `shader` defaults to the current `NIGHT_SHADER` but callers should pass
 * a freshly-created shader (from `createNightShader`) so the mask texture
 * is baked in before the first compile.
 */
export function applyNightMode(
  viewer: Viewer,
  tilesetRef: { current: { style: Cesium3DTileStyle | undefined; customShader: CustomShader | undefined } | null },
  shader: CustomShader = NIGHT_SHADER,
): () => void {
  if (viewer.isDestroyed()) return () => {};

  const tileset = tilesetRef.current;
  const prevCustomShader = tileset?.customShader;
  const prevStyle = tileset?.style;

  if (tileset) {
    tileset.customShader = shader;
    tileset.style = undefined;
  }

  if (viewer.scene.skyAtmosphere) {
    viewer.scene.skyAtmosphere.show = false;
  }
  viewer.scene.backgroundColor = Color.BLACK;

  return () => {
    if (viewer.isDestroyed()) return;
    if (tileset) {
      tileset.customShader = prevCustomShader;
      tileset.style = prevStyle;
    }
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.show = true;
    }
  };
}

/**
 * Extract RGBA pixel data from a mask canvas (MASK_SIZE × MASK_SIZE).
 * Returns a typed array suitable for `createNightShader(pixels)`.
 */
export function getMaskPixels(canvas: HTMLCanvasElement): Uint8Array | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const imageData = ctx.getImageData(0, 0, MASK_SIZE, MASK_SIZE);
  return new Uint8Array(imageData.data);
}
