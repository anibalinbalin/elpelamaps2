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
 * Night mode via CustomShader on Google Photorealistic 3D Tiles.
 *
 * Uses MODIFY_MATERIAL so material.diffuse contains the actual baked tile
 * texture. The shader darkens with a moonlit blue tint and detects bright
 * spots for warm window glow. Ocean/waves are masked dark.
 *
 * Exclusion zones use a painted mask texture instead of fixed circles.
 */

export const NIGHT_SHADER = new CustomShader({
  mode: CustomShaderMode.MODIFY_MATERIAL,
  lightingModel: LightingModel.UNLIT,
  uniforms: {
    // --- Moonlit tint ---
    u_tintR: { type: UniformType.FLOAT, value: 0.040 },
    u_tintG: { type: UniformType.FLOAT, value: 0.110 },
    u_tintB: { type: UniformType.FLOAT, value: 0.680 },
    u_tintBrightness: { type: UniformType.FLOAT, value: 1.000 },
    // --- Ocean masking ---
    u_waterBlueMin: { type: UniformType.FLOAT, value: 1.600 },
    u_waterBlueMax: { type: UniformType.FLOAT, value: 0.950 },
    u_waterSatMin: { type: UniformType.FLOAT, value: 0.070 },
    u_waterSatMax: { type: UniformType.FLOAT, value: 0.110 },
    u_waterDarken: { type: UniformType.FLOAT, value: 0.110 },
    // --- Window detection ---
    u_winLumMin: { type: UniformType.FLOAT, value: 0.870 },
    u_winLumMax: { type: UniformType.FLOAT, value: 1.000 },
    u_winSatMin: { type: UniformType.FLOAT, value: 0.220 },
    u_winSatMax: { type: UniformType.FLOAT, value: 0.670 },
    // --- Window glow ---
    u_glowR: { type: UniformType.FLOAT, value: 1.000 },
    u_glowG: { type: UniformType.FLOAT, value: 0.780 },
    u_glowB: { type: UniformType.FLOAT, value: 0.360 },
    u_glowIntensity: { type: UniformType.FLOAT, value: 1.500 },
    // --- Exclusion mask (texture-based) ---
    u_maskTex: {
      type: UniformType.SAMPLER_2D,
      value: new TextureUniform({
        typedArray: new Uint8Array([0, 0, 0, 0]),
        width: 1,
        height: 1,
      }),
    },
    u_boundsMinLon: { type: UniformType.FLOAT, value: MASK_BOUNDS_LON_LAT.sw[0] * DEG2RAD },
    u_boundsMinLat: { type: UniformType.FLOAT, value: MASK_BOUNDS_LON_LAT.sw[1] * DEG2RAD },
    u_boundsMaxLon: { type: UniformType.FLOAT, value: MASK_BOUNDS_LON_LAT.ne[0] * DEG2RAD },
    u_boundsMaxLat: { type: UniformType.FLOAT, value: MASK_BOUNDS_LON_LAT.ne[1] * DEG2RAD },
  },
  fragmentShaderText: /* glsl */ `
    void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
      vec3 original = material.diffuse;
      float luminance = dot(original, vec3(0.2126, 0.7152, 0.0722));

      // --- Moonlit blue tint ---
      vec3 tint = vec3(u_tintR, u_tintG, u_tintB);
      vec3 nightColor = original * tint * u_tintBrightness;

      // --- Ocean/wave masking ---
      float blueRatio = original.b / (luminance + 0.001);
      float maxC = max(original.r, max(original.g, original.b));
      float minC = min(original.r, min(original.g, original.b));
      float saturation = (maxC > 0.001) ? (maxC - minC) / maxC : 0.0;
      float isWater = smoothstep(u_waterBlueMin, u_waterBlueMax, blueRatio)
                    * smoothstep(u_waterSatMin, u_waterSatMax, saturation);
      nightColor *= mix(1.0, u_waterDarken, isWater);

      // --- Window detection ---
      float lumScore = smoothstep(u_winLumMin, u_winLumMax, luminance);
      float satScore = 1.0 - smoothstep(u_winSatMin, u_winSatMax, saturation);
      float windowScore = lumScore * satScore;

      // --- Exclusion mask (texture-based) ---
      // Convert ECEF world coordinates to geodetic lon/lat (radians).
      // atan(z, p) gives geocentric lat; multiplying p by (1 - e²) converts
      // to geodetic lat so it matches the WGS84 coordinates in the mask bounds.
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

      // --- Composite (mask only suppresses glow, night tint stays) ---
      vec3 nightResult = mix(nightColor, glow, windowScore);
      material.diffuse = nightResult;
    }
  `,
});

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
 */
export function applyNightMode(
  viewer: Viewer,
  tilesetRef: { current: { style: Cesium3DTileStyle | undefined; customShader: CustomShader | undefined } | null },
): () => void {
  if (viewer.isDestroyed()) return () => {};

  const tileset = tilesetRef.current;
  const prevCustomShader = tileset?.customShader;
  const prevStyle = tileset?.style;

  if (tileset) {
    tileset.customShader = NIGHT_SHADER;
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
 * Upload a mask canvas to the night shader's `u_maskTex` uniform.
 * The canvas must be MASK_SIZE x MASK_SIZE.
 */
export function updateMaskTexture(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const imageData = ctx.getImageData(0, 0, MASK_SIZE, MASK_SIZE);
  const rgba = new Uint8Array(imageData.data.buffer);
  NIGHT_SHADER.setUniform(
    "u_maskTex",
    new TextureUniform({ typedArray: rgba, width: MASK_SIZE, height: MASK_SIZE }),
  );
}
