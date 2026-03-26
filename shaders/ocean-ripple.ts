/**
 * Living World fragment shader for @react-three/postprocessing.
 *
 * Uses a painted mask texture (R=wave, G=canopy) looked up via
 * depth-reconstructed world position → ECEF → lon/lat → mask UV.
 *
 * Built-in uniforms available in Effects:
 *   cameraNear, cameraFar, resolution, texelSize, aspect, time,
 *   inputBuffer, depthBuffer
 *
 * NOT available in Effects (must pass as custom uniforms):
 *   projectionMatrix, projectionMatrixInverse, getViewPosition()
 */

export const livingWorldFragmentShader = /* glsl */ `
  // Mask texture: R = wave zones, G = canopy zones
  uniform sampler2D u_maskTex;

  // Matrices we must pass ourselves (not available in Effect scope)
  uniform mat4 u_projMatrix;
  uniform mat4 u_projMatrixInverse;
  uniform mat4 u_inverseViewMatrix;
  uniform mat4 u_worldToECEFMatrix;

  // Mask geographic bounds (radians)
  uniform float u_boundsMinLon;
  uniform float u_boundsMinLat;
  uniform float u_boundsMaxLon;
  uniform float u_boundsMaxLat;

  // Wave animation
  uniform float u_waveSpeed;
  uniform float u_waveAmplitude;
  uniform float u_waveFrequency;

  // Canopy sway animation
  uniform float u_swaySpeed;
  uniform float u_swayAmplitude;
  uniform float u_swayFrequency;

  // Camera altitude for fade
  uniform float u_cameraAltitude;

  // Toggles
  uniform float u_enabled;
  uniform float u_debugMask;

  // Inline getViewPosition — not available in Effect fragment shaders
  vec3 reconstructViewPosition(vec2 screenPos, float fragDepth) {
    // depth → viewZ (perspective camera)
    float viewZ = cameraNear * cameraFar / ((cameraFar - cameraNear) * fragDepth - cameraFar);

    // Screen pos + depth → clip space → view space
    vec4 clipPos = vec4(vec3(screenPos, fragDepth) * 2.0 - 1.0, 1.0);
    float clipW = u_projMatrix[2][3] * viewZ + u_projMatrix[3][3];
    clipPos *= clipW;
    return (u_projMatrixInverse * clipPos).xyz;
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
    if (u_enabled < 0.5) {
      outputColor = inputColor;
      return;
    }

    // Skip sky pixels (depth at far plane)
    if (depth >= 1.0) {
      outputColor = inputColor;
      return;
    }

    // --- Reconstruct world position from depth ---
    vec3 viewPos = reconstructViewPosition(uv, depth);

    // View → world
    vec4 worldPos4 = u_inverseViewMatrix * vec4(viewPos, 1.0);
    vec3 worldPos = worldPos4.xyz;

    // World → ECEF
    vec4 ecef4 = u_worldToECEFMatrix * vec4(worldPos, 1.0);
    vec3 ecef = ecef4.xyz;

    // --- ECEF → lon/lat (same math as night shader) ---
    float lon = atan(ecef.y, ecef.x);
    float p = sqrt(ecef.x * ecef.x + ecef.y * ecef.y);
    float lat = atan(ecef.z, p * (1.0 - 0.00669438)); // WGS84 eccentricity

    // --- lon/lat → mask UV ---
    vec2 maskUV = vec2(
      (lon - u_boundsMinLon) / (u_boundsMaxLon - u_boundsMinLon),
      (lat - u_boundsMinLat) / (u_boundsMaxLat - u_boundsMinLat)
    );
    maskUV.y = 1.0 - maskUV.y; // Canvas row 0 = north, UV.y=0 = bottom
    maskUV = clamp(maskUV, 0.0, 1.0);

    // --- Sample mask ---
    vec4 mask = texture2D(u_maskTex, maskUV);
    float waveMask = mask.r;
    float canopyMask = mask.g;

    // --- Altitude fade ---
    float altFade = smoothstep(3000.0, 800.0, u_cameraAltitude);
    waveMask *= altFade;
    canopyMask *= altFade;

    // --- Debug mask mode ---
    if (u_debugMask > 0.5) {
      vec3 debugColor = inputColor.rgb;
      debugColor = mix(debugColor, vec3(0.2, 0.5, 1.0), waveMask * 0.5);   // Blue for waves
      debugColor = mix(debugColor, vec3(0.2, 0.9, 0.3), canopyMask * 0.5);  // Green for canopy
      outputColor = vec4(debugColor, inputColor.a);
      return;
    }

    // --- Wave distortion ---
    float t = time * u_waveSpeed;
    float waveAmp = u_waveAmplitude * waveMask;

    vec2 ripple = vec2(
      sin(uv.y * u_waveFrequency + t) * waveAmp
        + sin(uv.y * u_waveFrequency * 1.7 + t * 0.7) * waveAmp * 0.4,
      cos(uv.x * u_waveFrequency * 0.8 + t * 0.9) * waveAmp * 0.6
        + cos(uv.x * u_waveFrequency * 2.3 + t * 1.3) * waveAmp * 0.25
    );

    // --- Canopy sway ---
    float st = time * u_swaySpeed;
    float swayAmp = u_swayAmplitude * canopyMask;

    vec2 sway = vec2(
      sin(uv.y * u_swayFrequency + st) * swayAmp
        + sin(uv.x * u_swayFrequency * 0.7 + st * 1.3) * swayAmp * 0.3,
      sin(uv.x * u_swayFrequency * 0.6 + st * 0.8) * swayAmp * 0.25
    );

    // --- Combine displacements ---
    vec2 totalDisplacement = ripple + sway;
    float totalMask = max(waveMask, canopyMask);

    if (totalMask < 0.001) {
      outputColor = inputColor;
      return;
    }

    vec4 displaced = texture2D(inputBuffer, uv + totalDisplacement);
    outputColor = vec4(mix(inputColor.rgb, displaced.rgb, totalMask), inputColor.a);
  }
`;
