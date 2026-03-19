export const JOSE_IGNACIO_CENTER = { lat: -34.7925, lon: -54.6335 } as const;
/** Camera ~1km altitude at a low angle to show terrain relief */
export const INITIAL_CAMERA_POSITION: [number, number, number] = [3000, 500, 3000];
/** Early afternoon in José Ignacio (Jan 15, ~2:00pm local = 17:00 UTC) */
export const GOLDEN_HOUR_DATE = new Date("2026-01-15T17:00:00Z");
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
  fill: "rgba(0, 200, 255, 0.15)",
  fillHover: "rgba(0, 200, 255, 0.3)",
  fillSelected: "rgba(0, 200, 255, 0.4)",
  stroke: "rgba(0, 255, 180, 0.6)",
  strokeHover: "rgba(0, 255, 180, 0.9)",
  strokeSelected: "rgba(0, 200, 255, 1)",
  strokeWidth: 2,
  strokeWidthSelected: 4,
};
