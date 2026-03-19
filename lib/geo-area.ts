/**
 * Compute the geodesic area of a polygon ring using the spherical excess formula.
 * Input: ring as [lon, lat][] in degrees.
 * Returns: area in square meters.
 */
const EARTH_RADIUS = 6371008.8;

export function sphericalArea(ring: [number, number][]): number {
  const coords = ring.map(([lon, lat]) => [
    (lon * Math.PI) / 180,
    (lat * Math.PI) / 180,
  ]);

  const n = coords.length;
  if (n < 3) return 0;

  let sum = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const k = (i + 2) % n;
    sum += (coords[k][0] - coords[i][0]) * Math.sin(coords[j][1]);
  }

  return Math.abs(sum * EARTH_RADIUS * EARTH_RADIUS * 0.5);
}
