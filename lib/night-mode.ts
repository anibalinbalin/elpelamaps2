import {
  Cesium3DTileStyle,
  Color,
  CustomShader,
  CustomShaderMode,
  LightingModel,
  UniformType,
  type Viewer,
} from "cesium";

/**
 * Night mode via CustomShader on Google Photorealistic 3D Tiles.
 *
 * Uses MODIFY_MATERIAL so material.diffuse contains the actual baked tile
 * texture. The shader darkens with a moonlit blue tint and detects bright
 * spots for warm window glow. Ocean/waves are masked dark.
 *
 * All tunable values are exposed as uniforms for real-time tweaking.
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

      // --- Window glow ---
      vec3 glowColor = vec3(u_glowR, u_glowG, u_glowB);
      vec3 glow = glowColor * u_glowIntensity * luminance;

      // --- Composite ---
      material.diffuse = mix(nightColor, glow, windowScore);
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
