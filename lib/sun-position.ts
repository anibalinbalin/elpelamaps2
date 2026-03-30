// lib/sun-position.ts

export interface SunAngles {
  azimuth: number;   // degrees 0–360, clockwise from north
  elevation: number; // degrees; positive = above horizon, negative = below
  isNight: boolean;  // elevation <= 0
  blend: number;     // 0 = full day, 1 = full night (smooth around horizon)
  colorTemp: { r: number; g: number; b: number };
}

// José Ignacio summer day approximation
// t: 0 = 6:00 AM, 1 = midnight (24:00 / next-day 00:00) — 18-hour range
// Sunrise ≈ 6:15 AM (hour 6.25), sunset ≈ 8:15 PM (hour 20.25)
const SUNRISE_HOUR = 6.25;
const SUNSET_HOUR = 20.25;
const SOLAR_NOON = (SUNRISE_HOUR + SUNSET_HOUR) / 2; // 13.25 = 1:15 PM

function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, f));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function computeElevation(hour: number): number {
  if (hour < SUNRISE_HOUR || hour > SUNSET_HOUR) {
    const distFromEdge = hour < SUNRISE_HOUR
      ? SUNRISE_HOUR - hour
      : hour - SUNSET_HOUR;
    return -Math.min(distFromEdge * 6, 40); // multiplier=6 so midnight reaches -22.5° (past -20° threshold)
  }
  const frac = (hour - SUNRISE_HOUR) / (SUNSET_HOUR - SUNRISE_HOUR);
  return 75 * Math.sin(Math.PI * frac); // peaks at 75° (summer, southern hemisphere)
}

function computeAzimuth(hour: number): number {
  // Southern hemisphere: sun arcs through north
  // Sunrise from SE (~110°), noon due north (0°/360°), sunset to SW (~250°)
  if (hour <= SOLAR_NOON) {
    const frac = (hour - SUNRISE_HOUR) / (SOLAR_NOON - SUNRISE_HOUR);
    return lerp(110, 0, frac);
  }
  const frac = (hour - SOLAR_NOON) / (SUNSET_HOUR - SOLAR_NOON);
  return lerp(0, 250, frac);
}

function computeColorTemp(elevation: number, isNight: boolean): { r: number; g: number; b: number } {
  if (isNight) return { r: 0.04, g: 0.11, b: 0.68 };
  if (elevation < 15) {
    const f = elevation / 15;
    return {
      r: lerp(0.9, 1.0, f),
      g: lerp(0.4, 0.95, f),
      b: lerp(0.1, 0.85, f),
    };
  }
  return { r: 1.0, g: 0.95, b: 0.85 };
}

export function timeToSunAngles(t: number): SunAngles {
  const hour = 6 + Math.max(0, Math.min(1, t)) * 18; // 6am to midnight
  const elevation = computeElevation(hour);
  const azimuth = computeAzimuth(hour);
  const isNight = elevation <= 0;
  const blend = isNight
    ? smoothstep(0, -20, elevation) // 0 at horizon → 1 past -20°
    : 0;
  const colorTemp = computeColorTemp(elevation, isNight);
  return { azimuth, elevation, isNight, blend, colorTemp };
}
