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
 * Instead of adding separate building geometry, this applies a GLSL fragment
 * shader directly to the tileset that:
 *   1. Darkens everything with a blue moonlit tint
 *   2. Detects "window-like" pixels by analyzing the original baked texture
 *   3. Replaces those pixels with a warm orange/yellow glow
 *
 * Google 3D tiles use KHR_materials_unlit — material.diffuse already contains
 * the final baked appearance including lighting, so we work with that directly.
 */

const NIGHT_SHADER = new CustomShader({
  // REPLACE_MATERIAL gives us full control over the final color
  mode: CustomShaderMode.REPLACE_MATERIAL,
  // UNLIT because Google tiles are already unlit (baked lighting)
  lightingModel: LightingModel.UNLIT,
  uniforms: {
    // Moonlit tint color (dark blue)
    u_tintColor: { type: UniformType.VEC3, value: { x: 0.075, y: 0.11, z: 0.20 } },
    // How much of the original color bleeds through (0 = pure tint, 1 = full original)
    u_moonlightBlend: { type: UniformType.FLOAT, value: 0.35 },
    // Window detection: minimum luminance to consider as a lit window
    u_luminanceThresh: { type: UniformType.FLOAT, value: 0.55 },
    // Window detection: maximum saturation (windows/glass tend to be desaturated)
    u_saturationMax: { type: UniformType.FLOAT, value: 0.35 },
    // Warm glow color for detected windows
    u_glowColor: { type: UniformType.VEC3, value: { x: 1.0, y: 0.78, z: 0.36 } },
    // How bright the window glow gets
    u_glowIntensity: { type: UniformType.FLOAT, value: 1.8 },
  },
  fragmentShaderText: /* glsl */ `
    void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
      // Original baked color from the photorealistic tile texture
      vec3 original = material.diffuse;

      // --- Luminance & saturation analysis ---
      float luminance = dot(original, vec3(0.2126, 0.7152, 0.0722));

      float maxC = max(original.r, max(original.g, original.b));
      float minC = min(original.r, min(original.g, original.b));
      float saturation = (maxC > 0.001) ? (maxC - minC) / maxC : 0.0;

      // --- Window detection score ---
      // High luminance + low saturation = likely a window or lit surface
      float lumScore = smoothstep(u_luminanceThresh - 0.1, u_luminanceThresh + 0.1, luminance);
      float satScore = 1.0 - smoothstep(u_saturationMax - 0.1, u_saturationMax + 0.15, saturation);

      // Also boost warm-toned bright pixels (interior warm light)
      float warmth = original.r / (original.b + 0.001);
      float warmScore = smoothstep(1.2, 2.5, warmth) * lumScore * 0.5;

      float windowScore = clamp(lumScore * satScore + warmScore, 0.0, 1.0);

      // --- Moonlit darkening ---
      // Blend original color toward the blue tint
      vec3 darkened = mix(u_tintColor, original * u_tintColor * 3.0, u_moonlightBlend);

      // --- Window glow ---
      vec3 glow = u_glowColor * u_glowIntensity * luminance;

      // Final compositing
      material.diffuse = mix(darkened, glow, windowScore);
    }
  `,
});

/**
 * Apply night mode to a Cesium viewer:
 * 1. Apply CustomShader to the 3D tileset for moonlit + window glow effect
 * 2. Hide sky atmosphere, set black background
 *
 * Returns a cleanup function to restore day mode.
 */
export function applyNightMode(
  viewer: Viewer,
  tilesetRef: { current: { style: Cesium3DTileStyle | undefined; customShader: CustomShader | undefined } | null },
): () => void {
  if (viewer.isDestroyed()) return () => {};

  const tileset = tilesetRef.current;
  const prevCustomShader = tileset?.customShader;
  const prevStyle = tileset?.style;

  // Apply the night shader
  if (tileset) {
    tileset.customShader = NIGHT_SHADER;
    // Clear any style that might interfere
    tileset.style = undefined;
  }

  // Hide daytime atmosphere
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
