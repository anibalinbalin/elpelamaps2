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
  // MODIFY_MATERIAL so material.diffuse contains the actual baked tile texture
  mode: CustomShaderMode.MODIFY_MATERIAL,
  // UNLIT because Google tiles are already unlit (baked lighting)
  lightingModel: LightingModel.UNLIT,
  uniforms: {
    // Night exposure — power curve exponent (higher = darker, 1.0 = no change)
    u_gamma: { type: UniformType.FLOAT, value: 1.8 },
    // Overall brightness scale after gamma
    u_exposure: { type: UniformType.FLOAT, value: 0.55 },
    // Window detection: minimum luminance to consider as a lit window
    u_luminanceThresh: { type: UniformType.FLOAT, value: 0.50 },
    // Warm glow color for detected windows
    u_glowColor: { type: UniformType.VEC3, value: { x: 1.0, y: 0.78, z: 0.36 } },
    // How bright the window glow gets
    u_glowIntensity: { type: UniformType.FLOAT, value: 2.5 },
  },
  fragmentShaderText: /* glsl */ `
    void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
      vec3 original = material.diffuse;
      float luminance = dot(original, vec3(0.2126, 0.7152, 0.0722));

      // --- Night tone curve ---
      // Gamma curve darkens midtones/shadows while preserving bright detail
      // This keeps contrast between roads, roofs, walls, trees visible
      vec3 curved = pow(original, vec3(u_gamma));

      // Desaturate and shift toward cool blue (moonlight color grading)
      float gray = dot(curved, vec3(0.2126, 0.7152, 0.0722));
      vec3 nightColor = vec3(
        gray * 0.7,            // reduce red
        gray * 0.8,            // slightly reduce green
        gray * 1.3             // boost blue
      ) * u_exposure;

      // Blend a hint of original color back for realism
      nightColor = mix(nightColor, curved * u_exposure, 0.15);

      // --- Window detection ---
      float maxC = max(original.r, max(original.g, original.b));
      float minC = min(original.r, min(original.g, original.b));
      float saturation = (maxC > 0.001) ? (maxC - minC) / maxC : 0.0;

      // Bright + desaturated = window/glass/light surface
      float lumScore = smoothstep(u_luminanceThresh - 0.1, u_luminanceThresh + 0.15, luminance);
      float satScore = 1.0 - smoothstep(0.25, 0.55, saturation);
      // Warm bright pixels (orangish light)
      float warmth = original.r / (original.b + 0.01);
      float warmBoost = smoothstep(1.3, 2.5, warmth) * lumScore * 0.5;

      float windowScore = clamp(lumScore * satScore + warmBoost, 0.0, 1.0);

      // --- Window glow ---
      vec3 glow = u_glowColor * u_glowIntensity * luminance;

      // --- Composite ---
      material.diffuse = mix(nightColor, glow, windowScore);
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
