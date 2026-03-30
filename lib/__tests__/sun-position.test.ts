import { describe, it, expect } from "vitest";
import { timeToSunAngles } from "../sun-position";

describe("timeToSunAngles", () => {
  it("returns high elevation at noon (t≈0.33)", () => {
    const { elevation } = timeToSunAngles(0.33);
    expect(elevation).toBeGreaterThan(50);
  });

  it("returns just-below-horizon elevation at start of range (t=0, hour 6:00 — 15min before sunrise)", () => {
    const { elevation } = timeToSunAngles(0);
    expect(elevation).toBeLessThan(10);
    expect(elevation).toBeGreaterThan(-10);
  });

  it("returns negative elevation at midnight (t=1)", () => {
    const { elevation, isNight, blend } = timeToSunAngles(1.0);
    expect(elevation).toBeLessThan(0);
    expect(isNight).toBe(true);
    expect(blend).toBe(1);
  });

  it("returns isNight=false and blend=0 at noon", () => {
    const { isNight, blend } = timeToSunAngles(0.33);
    expect(isNight).toBe(false);
    expect(blend).toBe(0);
  });

  it("returns warm colorTemp (r > b) near sunset (t=0.77, elevation ~9°)", () => {
    // t=0.77 → hour 19.86 → ~15 min before sunset; elevation ≈ 9° (warm-color branch)
    const { colorTemp } = timeToSunAngles(0.77);
    expect(colorTemp.r).toBeGreaterThan(colorTemp.b);
  });

  it("returns blue colorTemp (b > r) at night (t=0.9)", () => {
    const { colorTemp } = timeToSunAngles(0.9);
    expect(colorTemp.b).toBeGreaterThan(colorTemp.r);
  });

  it("returns azimuth in 0–360 for all t", () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1.0]) {
      const { azimuth } = timeToSunAngles(t);
      expect(azimuth).toBeGreaterThanOrEqual(0);
      expect(azimuth).toBeLessThanOrEqual(360);
    }
  });
});
