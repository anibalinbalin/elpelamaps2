import type { Feature, FeatureCollection, Polygon } from "geojson";

// ---------------------------------------------------------------------------
// Night exclusion zone types
// ---------------------------------------------------------------------------

export interface NightZoneProperties {
  id: string;
  name: string;
}

export type NightZoneFeature = Feature<Polygon, NightZoneProperties>;
export type NightZoneCollection = FeatureCollection<Polygon, NightZoneProperties>;

// ---------------------------------------------------------------------------
// Rasterize polygon zones onto a mask canvas
// ---------------------------------------------------------------------------

/**
 * Fill a canvas with red pixels for every polygon in the zone collection.
 * The canvas maps to geographic bounds (lon/lat) so that the Cesium night
 * shader can sample it as a texture via world-position UV mapping.
 */
export function rasterizeZonesToCanvas(
  canvas: HTMLCanvasElement,
  zones: NightZoneCollection,
  bounds: { sw: [number, number]; ne: [number, number] },
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const [swLon, swLat] = bounds.sw;
  const [neLon, neLat] = bounds.ne;
  const dLon = neLon - swLon;
  const dLat = neLat - swLat;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255, 0, 0, 1)";

  for (const feature of zones.features) {
    const rings = feature.geometry.coordinates;
    for (const ring of rings) {
      ctx.beginPath();
      for (let i = 0; i < ring.length; i++) {
        const [lon, lat] = ring[i];
        const px = ((lon - swLon) / dLon) * w;
        const py = (1 - (lat - swLat) / dLat) * h;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
  }
}
