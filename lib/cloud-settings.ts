export type CloudQualityPreset = "low" | "medium" | "high" | "ultra";
export type CloudPresetId = "subtle" | "cinematic" | "dramatic";

export interface CloudLayerSettings {
  channel: "r" | "g" | "b";
  altitude: number;
  height: number;
  densityScale: number;
  shapeAmount: number;
  shapeDetailAmount: number;
  weatherExponent: number;
  coverageFilterWidth: number;
  shadow: boolean;
}

export interface CloudSettings {
  qualityPreset: CloudQualityPreset;
  resolutionScale: number;
  coverage: number;
  localWeatherRepeat: [number, number];
  localWeatherVelocity: [number, number];
  shapeVelocity: [number, number, number];
  shapeDetailVelocity: [number, number, number];
  layers: CloudLayerSettings[];
}

export const CLOUD_PRESETS: Record<CloudPresetId, CloudSettings> = {
  subtle: {
    qualityPreset: "medium",
    resolutionScale: 0.9,
    coverage: 0.44,
    localWeatherRepeat: [8.5, 8.5],
    localWeatherVelocity: [0.0012, -0.0006],
    shapeVelocity: [0.00002, 0, 0.00001],
    shapeDetailVelocity: [0.0001, 0, 0.00004],
    layers: [
      {
        channel: "r",
        altitude: 700,
        height: 620,
        densityScale: 0.17,
        shapeAmount: 0.84,
        shapeDetailAmount: 0.18,
        weatherExponent: 0.9,
        coverageFilterWidth: 0.62,
        shadow: true,
      },
      {
        channel: "g",
        altitude: 1100,
        height: 1200,
        densityScale: 0.15,
        shapeAmount: 0.88,
        shapeDetailAmount: 0.2,
        weatherExponent: 0.94,
        coverageFilterWidth: 0.58,
        shadow: true,
      },
      {
        channel: "b",
        altitude: 6500,
        height: 650,
        densityScale: 0.01,
        shapeAmount: 0.36,
        shapeDetailAmount: 0.02,
        weatherExponent: 1,
        coverageFilterWidth: 0.5,
        shadow: false,
      },
    ],
  },
  cinematic: {
    qualityPreset: "high",
    resolutionScale: 0.95,
    coverage: 0.58,
    localWeatherRepeat: [6.4, 6.4],
    localWeatherVelocity: [0.0012, -0.0005],
    shapeVelocity: [0.00002, 0, 0.00001],
    shapeDetailVelocity: [0.00012, 0, 0.00005],
    layers: [
      {
        channel: "r",
        altitude: 620,
        height: 820,
        densityScale: 0.22,
        shapeAmount: 0.82,
        shapeDetailAmount: 0.22,
        weatherExponent: 0.74,
        coverageFilterWidth: 0.72,
        shadow: true,
      },
      {
        channel: "g",
        altitude: 1250,
        height: 1450,
        densityScale: 0.18,
        shapeAmount: 0.88,
        shapeDetailAmount: 0.22,
        weatherExponent: 0.8,
        coverageFilterWidth: 0.66,
        shadow: true,
      },
      {
        channel: "b",
        altitude: 5200,
        height: 900,
        densityScale: 0.018,
        shapeAmount: 0.42,
        shapeDetailAmount: 0.05,
        weatherExponent: 0.96,
        coverageFilterWidth: 0.54,
        shadow: true,
      },
    ],
  },
  dramatic: {
    qualityPreset: "high",
    resolutionScale: 1,
    coverage: 0.74,
    localWeatherRepeat: [5.2, 5.2],
    localWeatherVelocity: [0.001, -0.0004],
    shapeVelocity: [0.00002, 0, 0.00001],
    shapeDetailVelocity: [0.00012, 0, 0.00005],
    layers: [
      {
        channel: "r",
        altitude: 520,
        height: 1100,
        densityScale: 0.27,
        shapeAmount: 0.78,
        shapeDetailAmount: 0.18,
        weatherExponent: 0.68,
        coverageFilterWidth: 0.78,
        shadow: true,
      },
      {
        channel: "g",
        altitude: 1180,
        height: 1750,
        densityScale: 0.23,
        shapeAmount: 0.84,
        shapeDetailAmount: 0.18,
        weatherExponent: 0.74,
        coverageFilterWidth: 0.72,
        shadow: true,
      },
      {
        channel: "b",
        altitude: 4300,
        height: 1200,
        densityScale: 0.025,
        shapeAmount: 0.38,
        shapeDetailAmount: 0.04,
        weatherExponent: 0.9,
        coverageFilterWidth: 0.62,
        shadow: true,
      },
    ],
  },
};

export const CLOUD_DEFAULT_SETTINGS: CloudSettings = cloneCloudSettings(
  CLOUD_PRESETS.cinematic,
);

export function cloneCloudSettings(
  settings: CloudSettings = CLOUD_DEFAULT_SETTINGS,
): CloudSettings {
  return {
    ...settings,
    localWeatherRepeat: [...settings.localWeatherRepeat] as [number, number],
    localWeatherVelocity: [...settings.localWeatherVelocity] as [number, number],
    shapeVelocity: [...settings.shapeVelocity] as [number, number, number],
    shapeDetailVelocity: [...settings.shapeDetailVelocity] as [number, number, number],
    layers: settings.layers.map((layer) => ({ ...layer })),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function sanitizeCloudSettings(
  input: Partial<CloudSettings> | undefined,
): CloudSettings {
  const settings = cloneCloudSettings({
    ...CLOUD_DEFAULT_SETTINGS,
    ...input,
    layers: input?.layers ?? CLOUD_DEFAULT_SETTINGS.layers,
  } as CloudSettings);

  const qualityPreset =
    settings.qualityPreset === "low" ||
    settings.qualityPreset === "medium" ||
    settings.qualityPreset === "high" ||
    settings.qualityPreset === "ultra"
      ? settings.qualityPreset
      : CLOUD_DEFAULT_SETTINGS.qualityPreset;

  return {
    qualityPreset,
    resolutionScale: clamp(settings.resolutionScale, 0.5, 1),
    coverage: clamp(settings.coverage, 0, 1),
    localWeatherRepeat: [
      clamp(settings.localWeatherRepeat[0], 1, 20),
      clamp(settings.localWeatherRepeat[1], 1, 20),
    ],
    localWeatherVelocity: [
      clamp(settings.localWeatherVelocity[0], -0.01, 0.01),
      clamp(settings.localWeatherVelocity[1], -0.01, 0.01),
    ],
    shapeVelocity: [
      clamp(settings.shapeVelocity[0], -0.001, 0.001),
      clamp(settings.shapeVelocity[1], -0.001, 0.001),
      clamp(settings.shapeVelocity[2], -0.001, 0.001),
    ],
    shapeDetailVelocity: [
      clamp(settings.shapeDetailVelocity[0], -0.001, 0.001),
      clamp(settings.shapeDetailVelocity[1], -0.001, 0.001),
      clamp(settings.shapeDetailVelocity[2], -0.001, 0.001),
    ],
    layers: settings.layers.slice(0, 3).map((layer, index) => ({
      channel: CLOUD_DEFAULT_SETTINGS.layers[index]?.channel ?? layer.channel,
      altitude: clamp(layer.altitude, 0, 6000),
      height: clamp(layer.height, 0, 3000),
      densityScale: clamp(layer.densityScale, 0, 0.4),
      shapeAmount: clamp(layer.shapeAmount, 0, 1),
      shapeDetailAmount: clamp(layer.shapeDetailAmount, 0, 1),
      weatherExponent: clamp(layer.weatherExponent, 0.2, 2),
      coverageFilterWidth: clamp(layer.coverageFilterWidth, 0, 1),
      shadow: Boolean(layer.shadow),
    })),
  };
}
