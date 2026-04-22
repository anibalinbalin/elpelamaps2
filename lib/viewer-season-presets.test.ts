import { describe, expect, it } from "vitest";

import {
  buildViewerTimestamp,
  VIEWER_SEASON_PRESETS,
} from "./viewer-season-presets";

describe("buildViewerTimestamp", () => {
  it("uses the expected anchor date for each season preset", () => {
    const expectedDates = {
      summer: "2024-01-15T21:00:00.000Z",
      autumn: "2024-04-15T21:00:00.000Z",
      winter: "2024-07-15T21:00:00.000Z",
      spring: "2024-10-15T21:00:00.000Z",
    } as const;

    for (const preset of VIEWER_SEASON_PRESETS) {
      expect(new Date(buildViewerTimestamp(preset.id, 18)).toISOString()).toBe(
        expectedDates[preset.id],
      );
    }
  });

  it("preserves the season date when only the local hour changes", () => {
    const morning = new Date(buildViewerTimestamp("winter", 9.5));
    const evening = new Date(buildViewerTimestamp("winter", 18.25));

    expect(morning.getUTCFullYear()).toBe(evening.getUTCFullYear());
    expect(morning.getUTCMonth()).toBe(evening.getUTCMonth());
    expect(morning.getUTCDate()).toBe(evening.getUTCDate());
  });

  it("produces different timestamps for different seasons at the same local hour", () => {
    const summer = buildViewerTimestamp("summer", 18);
    const winter = buildViewerTimestamp("winter", 18);

    expect(summer).not.toBe(winter);
  });
});
