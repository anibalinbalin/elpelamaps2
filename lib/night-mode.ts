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
    // How dark the scene gets (0 = black, 1 = original brightness)
    u_darkness: { type: UniformType.FLOAT, value: 0.18 },
    // Blue shift strength for moonlit feel
    u_blueShift: { type: UniformType.FLOAT, value: 0.35 },
    // Window detection: minimum luminance to consider as a lit window
    u_luminanceThresh: { type: UniformType.FLOAT, value: 0.45 },
    // Window detection: maximum saturation (windows/glass tend to be desaturated)
    u_saturationMax: { type: UniformType.FLOAT, value: 0.40 },
    // Warm glow color for detected windows
    u_glowColor: { type: UniformType.VEC3, value: { x: 1.0, y: 0.78, z: 0.36 } },
    // How bright the window glow gets
    u_glowIntensity: { type: UniformType.FLOAT, value: 2.2 },
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
      float lumScore = smoothstep(u_luminanceThresh - 0.12, u_luminanceThresh + 0.12, luminance);
      float satScore = 1.0 - smoothstep(u_saturationMax - 0.1, u_saturationMax + 0.2, saturation);

      // Also boost warm-toned bright pixels (interior warm light)
      float warmth = original.r / (original.b + 0.001);
      float warmScore = smoothstep(1.3, 2.5, warmth) * lumScore * 0.4;

      float windowScore = clamp(lumScore * satScore + warmScore, 0.0, 1.0);

      // --- Moonlit darkening ---
      // Desaturate, then darken, then shift toward blue
      // This preserves building structure/detail while feeling nighttime
      float gray = luminance;
      vec3 desaturated = mix(vec3(gray), original, 0.3); // mostly gray, hint of color
      vec3 darkened = desaturated * u_darkness;           // darken significantly
      // Blue shift: push toward blue in the shadows
      darkened.b += u_blueShift * (1.0 - luminance) * 0.08;
      darkened.g += u_blueShift * (1.0 - luminance) * 0.03;

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
