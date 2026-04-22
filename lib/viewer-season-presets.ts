export type SeasonPresetId = "summer" | "autumn" | "winter" | "spring";

export interface SeasonPreset {
  id: SeasonPresetId;
  label: string;
  monthIndex: number;
  day: number;
}

const REFERENCE_YEAR = 2024;
export const URUGUAY_UTC_OFFSET_HOURS = -3;

export const VIEWER_SEASON_PRESETS: SeasonPreset[] = [
  { id: "summer", label: "Summer", monthIndex: 0, day: 15 },
  { id: "autumn", label: "Autumn", monthIndex: 3, day: 15 },
  { id: "winter", label: "Winter", monthIndex: 6, day: 15 },
  { id: "spring", label: "Spring", monthIndex: 9, day: 15 },
];

export const DEFAULT_VIEWER_SEASON_PRESET_ID: SeasonPresetId = "summer";

export function getViewerSeasonPreset(id: SeasonPresetId): SeasonPreset {
  const preset = VIEWER_SEASON_PRESETS.find((candidate) => candidate.id === id);
  if (!preset) {
    throw new Error(`Unknown viewer season preset: ${id}`);
  }
  return preset;
}

export function buildViewerTimestamp(
  seasonId: SeasonPresetId,
  hourLocal: number,
): number {
  const preset = getViewerSeasonPreset(seasonId);
  const localMinutes = Math.round(hourLocal * 60);
  const utcMinutes = localMinutes - URUGUAY_UTC_OFFSET_HOURS * 60;

  return Date.UTC(
    REFERENCE_YEAR,
    preset.monthIndex,
    preset.day,
    0,
    utcMinutes,
  );
}
