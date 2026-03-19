"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PlaneGeometry,
} from "three";
import { JOSE_IGNACIO_CENTER } from "@/lib/constants";

/**
 * MapboxTerrainLayer
 *
 * Fetches Mapbox terrain-RGB tiles, decodes elevation, and creates
 * a flat terrain mesh in the ReorientationPlugin's local frame.
 *
 * After ReorientationPlugin recenters to José Ignacio:
 * - Origin (0,0,0) = José Ignacio at sea level
 * - X axis = roughly East
 * - Y axis = Up
 * - Z axis = roughly South (negative = North)
 *
 * We create a horizontal plane with vertices displaced vertically by elevation.
 */

const TILE_ZOOM = 12;
const SEGMENTS = 127;
const ELEVATION_SCALE = 5; // Exaggerate elevation for visibility

/** Approximate meters per degree at a given latitude */
function metersPerDegree(lat: number) {
  const latRad = (lat * Math.PI) / 180;
  const mPerDegreeLat = 111132.92 - 559.82 * Math.cos(2 * latRad);
  const mPerDegreeLon = 111412.84 * Math.cos(latRad);
  return { lat: mPerDegreeLat, lon: mPerDegreeLon };
}

/** Convert lat/lon to tile x/y at a given zoom level */
function latLonToTile(lat: number, lon: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y };
}

/** Get the lat/lon bounds of a tile */
function tileBounds(x: number, y: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const lonMin = (x / n) * 360 - 180;
  const lonMax = ((x + 1) / n) * 360 - 180;
  const latMaxRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const latMinRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n)));
  return {
    latMin: (latMinRad * 180) / Math.PI,
    latMax: (latMaxRad * 180) / Math.PI,
    lonMin,
    lonMax,
  };
}

/** Decode Mapbox terrain-RGB pixel to elevation in meters */
function decodeElevation(r: number, g: number, b: number): number {
  return -10000 + (r * 256 * 256 + g * 256 + b) * 0.1;
}

/** Fetch and decode a terrain-RGB tile into a height array */
async function fetchHeightmap(
  x: number,
  y: number,
  zoom: number,
  token: string
): Promise<Float32Array | null> {
  const url = `https://api.mapbox.com/v4/mapbox.terrain-rgb/${zoom}/${x}/${y}@2x.pngraw?access_token=${token}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);

    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    const pixels = imageData.data;

    const size = SEGMENTS + 1;
    const heights = new Float32Array(size * size);
    const scaleX = bitmap.width / size;
    const scaleY = bitmap.height / size;

    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const px = Math.min(Math.floor(col * scaleX), bitmap.width - 1);
        const py = Math.min(Math.floor(row * scaleY), bitmap.height - 1);
        const idx = (py * bitmap.width + px) * 4;
        heights[row * size + col] = decodeElevation(
          pixels[idx],
          pixels[idx + 1],
          pixels[idx + 2]
        );
      }
    }

    return heights;
  } catch {
    return null;
  }
}

interface TerrainData {
  heights: Float32Array;
  bounds: { latMin: number; latMax: number; lonMin: number; lonMax: number };
}

function TerrainMesh({ heights, bounds }: TerrainData) {
  const geometry = useMemo(() => {
    const size = SEGMENTS + 1;
    const meters = metersPerDegree(JOSE_IGNACIO_CENTER.lat);
    const geo = new PlaneGeometry(1, 1, SEGMENTS, SEGMENTS);
    const positions = geo.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      const col = i % size;
      const row = Math.floor(i / size);

      const u = col / SEGMENTS;
      const v = row / SEGMENTS;

      // Lat/lon of this vertex
      const lat = bounds.latMax - v * (bounds.latMax - bounds.latMin);
      const lon = bounds.lonMin + u * (bounds.lonMax - bounds.lonMin);

      // Convert to local meters relative to José Ignacio center
      const eastMeters = (lon - JOSE_IGNACIO_CENTER.lon) * meters.lon;
      const northMeters = (lat - JOSE_IGNACIO_CENTER.lat) * meters.lat;
      const elevation = heights[row * size + col];

      // In ReorientationPlugin's local frame:
      // X = East, Y = Up, Z = -North (south)
      positions.setXYZ(i, eastMeters, elevation * ELEVATION_SCALE, -northMeters);
    }

    positions.needsUpdate = true;
    geo.computeVertexNormals();

    return geo;
  }, [heights, bounds]);

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial
        color="#44aa66"
        wireframe
        transparent
        opacity={0.15}
        depthWrite={false}
      />
    </mesh>
  );
}

export function MapboxTerrainLayer() {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const [terrainData, setTerrainData] = useState<TerrainData | null>(null);

  const tile = useMemo(
    () => latLonToTile(JOSE_IGNACIO_CENTER.lat, JOSE_IGNACIO_CENTER.lon, TILE_ZOOM),
    []
  );

  useEffect(() => {
    if (!token) return;

    const bounds = tileBounds(tile.x, tile.y, TILE_ZOOM);

    fetchHeightmap(tile.x, tile.y, TILE_ZOOM, token).then((heights) => {
      if (heights) {
        console.log("[MapboxTerrain] Loaded tile", tile, "bounds", bounds);
        let minH = Infinity, maxH = -Infinity;
        for (let i = 0; i < heights.length; i++) {
          if (heights[i] < minH) minH = heights[i];
          if (heights[i] > maxH) maxH = heights[i];
        }
        console.log("[MapboxTerrain] Elevation range:", minH, "to", maxH, "meters");
        setTerrainData({ heights, bounds });
      }
    });
  }, [token, tile]);

  if (!token || !terrainData) return null;

  return <TerrainMesh heights={terrainData.heights} bounds={terrainData.bounds} />;
}
