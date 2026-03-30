# Shadow Map Probe — Result: INCOMPATIBLE

Date: 2026-03-30
Probe: Enable viewer.shadows + ShadowMode.ENABLED on Google Photorealistic 3D Tiles (LightingModel.UNLIT)
Result: No shadows rendered. LightingModel.UNLIT bypasses Cesium's shadow map fragment shader sampling.
Decision: Phase 1 (N·L fragment shader) is the final state. Shadows are shader-driven only.
Revert: The clock-drive (`viewer.clock.currentTime = arcTToJulianDate(t)`) is kept — it's harmless and drives sky atmosphere updates. The `viewer.shadows` toggle is also kept (no-op on UNLIT tiles but adds the sky atmosphere shadow effect on terrain).
Alternative path (not pursued): manually sample czm_shadowMap inside the CustomShader fragment shader.
