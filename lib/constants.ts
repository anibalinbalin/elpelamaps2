export const JOSE_IGNACIO_CENTER = { lat: -34.8295, lon: -54.633 } as const;
/** Camera positioned to frame Lote1/Lote2 parcels */
export const INITIAL_CAMERA_POSITION: [number, number, number] = [-900, 1200, -1400];
export type ViewerLightingDirectionId =
  | "natural-depth"
  | "cinematic-depth";

export interface TileReliefPreset {
  lightDirection: [number, number, number];
  ambient: number;
  wrap: number;
  directionalStrength: number;
  shadowStrength: number;
  topLight: number;
  curvatureStrength: number;
  curvatureScale: number;
  rimStrength: number;
}

interface ViewerLightingDirectionPreset {
  label: string;
  description: string;
  presentationDate: Date;
  groundAlbedo: string;
  showSun: boolean;
  sunAngularRadius: number;
  aerialPerspective: {
    albedoScale: number;
  };
  toneMapping: {
    whitePoint: number;
    middleGrey: number;
  };
  post: {
    brightness: number;
    contrast: number;
    saturation: number;
    vignetteOffset: number;
    vignetteDarkness: number;
  };
  ambientOcclusion: {
    intensity: number;
    aoRadius: number;
    distanceFalloff: number;
    denoiseRadius: number;
  };
  tileRelief: TileReliefPreset;
  terrainDisplacementScale: number;
}

/**
 * Lighting studies for the public viewer.
 *
 * `natural-depth` keeps the world grounded and readable, while
 * `cinematic-depth` leans warmer and more pronounced to see if the bolder
 * presentation sells the land better.
 */
export const VIEWER_LIGHTING_DIRECTIONS: Record<
  ViewerLightingDirectionId,
  ViewerLightingDirectionPreset
> = {
  "natural-depth": {
    label: "Natural Depth",
    description: "Grounded daylight with cleaner haze and truer terrain separation.",
    presentationDate: new Date("2026-01-15T16:45:00Z"),
    groundAlbedo: "#dcc8a3",
    showSun: false,
    sunAngularRadius: 0.00475,
    aerialPerspective: {
      albedoScale: 1.52,
    },
    toneMapping: {
      whitePoint: 11.8,
      middleGrey: 0.72,
    },
    post: {
      brightness: -0.01,
      contrast: 0.1,
      saturation: 0.03,
      vignetteOffset: 0.48,
      vignetteDarkness: 0.22,
    },
    ambientOcclusion: {
      intensity: 4.2,
      aoRadius: 5,
      distanceFalloff: 0.42,
      denoiseRadius: 14,
    },
    tileRelief: {
      lightDirection: [0.66, 0.62, -0.42],
      ambient: 0.968,
      wrap: 0.48,
      directionalStrength: 0.11,
      shadowStrength: 0.2,
      topLight: 0.018,
      curvatureStrength: 0.12,
      curvatureScale: 5.2,
      rimStrength: 0.055,
    },
    terrainDisplacementScale: 4.25,
  },
  "cinematic-depth": {
    label: "Cinematic Depth",
    description: "Warmer haze, deeper falloff, and bolder relief for presentation.",
    presentationDate: new Date("2026-01-15T20:05:00Z"),
    groundAlbedo: "#d4b182",
    showSun: false,
    sunAngularRadius: 0.00455,
    aerialPerspective: {
      albedoScale: 2.36,
    },
    toneMapping: {
      whitePoint: 8.9,
      middleGrey: 0.58,
    },
    post: {
      brightness: -0.04,
      contrast: 0.26,
      saturation: 0.09,
      vignetteOffset: 0.38,
      vignetteDarkness: 0.38,
    },
    ambientOcclusion: {
      intensity: 3.4,
      aoRadius: 6.5,
      distanceFalloff: 0.38,
      denoiseRadius: 16,
    },
    tileRelief: {
      lightDirection: [0.36, 0.58, -0.73],
      ambient: 0.952,
      wrap: 0.38,
      directionalStrength: 0.145,
      shadowStrength: 0.26,
      topLight: 0.026,
      curvatureStrength: 0.15,
      curvatureScale: 5.8,
      rimStrength: 0.085,
    },
    terrainDisplacementScale: 10.5,
  },
};

export const DEFAULT_VIEWER_LIGHTING_DIRECTION: ViewerLightingDirectionId =
  "natural-depth";
/** Keep visitors near the sales area instead of letting them roam the whole globe. */
export const VIEW_TRAVEL_LIMITS = {
  minDistance: 450,
  maxDistance: 3200,
  minHeight: 320,
  maxHeight: 1800,
  maxHorizontalDistance: 3600,
} as const;
/** Conservative streaming budget for public viewers. */
export const TILE_STREAMING_BUDGET = {
  errorTarget: 22,
  loadSiblings: false,
  maxTilesProcessed: 96,
  parseJobs: 6,
  downloadJobs: 12,
} as const;
export const PARCEL_COLORS: {
  fill: string;
  fillHover: string;
  fillSelected: string;
  stroke: string;
  strokeHover: string;
  strokeSelected: string;
  strokeWidth: number;
  strokeWidthSelected: number;
} = {
  fill: "rgba(247, 240, 219, 0.2)",
  fillHover: "rgba(252, 245, 224, 0.26)",
  fillSelected: "rgba(255, 229, 170, 0.34)",
  stroke: "rgba(255, 251, 240, 0.94)",
  strokeHover: "rgba(255, 249, 236, 1)",
  strokeSelected: "rgba(255, 201, 107, 1)",
  strokeWidth: 2.35,
  strokeWidthSelected: 3.15,
};
