export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
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
