import { PostProcessStage } from "cesium";

const NIGHT_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D colorTexture;
  in vec2 v_textureCoordinates;

  const float DARKEN = 0.12;
  const float LUMINANCE_THRESH = 0.55;
  const float SATURATION_MAX = 0.35;
  const float GLOW_INTENSITY = 1.8;
  const float STAR_DENSITY = 800.0;
  const float SKY_THRESHOLD = 0.04;

  const vec3 WARM_GLOW = vec3(1.0, 0.82, 0.55);
  const vec3 MOON_TINT = vec3(0.7, 0.78, 1.0);

  float luminance(vec3 c) {
    return dot(c, vec3(0.2126, 0.7152, 0.0722));
  }

  float saturation(vec3 c) {
    float mn = min(min(c.r, c.g), c.b);
    float mx = max(max(c.r, c.g), c.b);
    return mx > 0.001 ? (mx - mn) / mx : 0.0;
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    vec4 sceneColor = texture(colorTexture, v_textureCoordinates);
    vec3 color = sceneColor.rgb;

    float lum = luminance(color);
    float sat = saturation(color);

    bool isLight = lum > LUMINANCE_THRESH
                && sat < SATURATION_MAX
                && color.r >= color.b * 0.85;

    vec3 nightBase = color * DARKEN * MOON_TINT;

    if (isLight) {
      float glowStrength = smoothstep(LUMINANCE_THRESH, 1.0, lum) * GLOW_INTENSITY;
      nightBase += WARM_GLOW * glowStrength * color;
    }

    float sceneLum = luminance(nightBase);
    if (sceneLum < SKY_THRESHOLD && v_textureCoordinates.y > 0.3) {
      vec2 starUV = v_textureCoordinates * STAR_DENSITY;
      vec2 starCell = floor(starUV);
      float starVal = hash(starCell);

      if (starVal > 0.985) {
        float brightness = (starVal - 0.985) / 0.015;
        float twinkle = 0.7 + 0.3 * sin(starCell.x * 12.9898 + starCell.y * 78.233);
        float horizonFade = smoothstep(0.3, 0.55, v_textureCoordinates.y);
        nightBase += vec3(brightness * twinkle * horizonFade * 0.9);
      }
    }

    out_FragColor = vec4(nightBase, sceneColor.a);
  }
`;

export function createNightModeStage(): PostProcessStage {
  return new PostProcessStage({
    name: "nightMode",
    fragmentShader: NIGHT_FRAGMENT_SHADER,
  });
}
