export const JOSE_IGNACIO_CENTER = { lat: -34.8295, lon: -54.633 } as const;
/** Camera positioned to frame Lote1/Lote2 parcels */
export const INITIAL_CAMERA_POSITION: [number, number, number] = [-900, 1200, -1400];
export type ViewerLightingDirectionId =
  | "natural-midday"
  | "art-directed-midday";

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
}

/**
 * Lighting studies for the public viewer.
 *
 * `natural-midday` keeps the sun high and implicit, while
 * `art-directed-midday` rotates into a slightly more present directional read
 * without reintroducing the cheap fixed hotspot.
 */
export const VIEWER_LIGHTING_DIRECTIONS: Record<
  ViewerLightingDirectionId,
  ViewerLightingDirectionPreset
> = {
  "natural-midday": {
    label: "Natural Midday",
    description: "Neutral overhead daylight with subdued solar presence.",
    presentationDate: new Date("2026-01-15T16:05:00Z"),
    groundAlbedo: "#e0cca6",
    showSun: false,
    sunAngularRadius: 0.0048,
    aerialPerspective: {
      albedoScale: 1.16,
    },
    toneMapping: {
      whitePoint: 14.2,
      middleGrey: 0.79,
    },
  },
  "art-directed-midday": {
    label: "Art-Directed Midday",
    description: "A slightly more sculpted midday angle with cleaner contrast.",
    presentationDate: new Date("2026-01-15T17:10:00Z"),
    groundAlbedo: "#e5cfaa",
    showSun: false,
    sunAngularRadius: 0.0046,
    aerialPerspective: {
      albedoScale: 1.2,
    },
    toneMapping: {
      whitePoint: 14.8,
      middleGrey: 0.8,
    },
  },
};

export const DEFAULT_VIEWER_LIGHTING_DIRECTION: ViewerLightingDirectionId =
  "natural-midday";
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
