export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function distanceMeters(
  a: [number, number],
  b: [number, number],
): number {
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const lat1Rad = degToRad(lat1);
  const lat2Rad = degToRad(lat2);
  const deltaLat = lat2Rad - lat1Rad;
  const deltaLon = degToRad(lon2 - lon1);

  const sinLat = Math.sin(deltaLat / 2);
  const sinLon = Math.sin(deltaLon / 2);
  const h =
    sinLat * sinLat +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * sinLon * sinLon;

  return 2 * 6371008.8 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function centroid(ring: [number, number][]): [number, number] {
  const vertices =
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1]
      ? ring.slice(0, -1)
      : ring;
  let lonSum = 0,
    latSum = 0;
  for (const [lon, lat] of vertices) {
    lonSum += lon;
    latSum += lat;
  }
  return [lonSum / vertices.length, latSum / vertices.length];
}

export function formatPrice(usd: number): string {
  return `USD ${usd.toLocaleString("en-US")}`;
}

export function formatArea(sqm: number): string {
  return `${sqm.toLocaleString("en-US")} m\u00B2`;
}

export function formatAreaCompact(areaSqMeters: number): string {
  if (areaSqMeters >= 10_000) {
    return `${(areaSqMeters / 10_000).toLocaleString("en-US", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    })} ha`;
  }

  return `${Math.round(areaSqMeters).toLocaleString("en-US")} sq m`;
}
