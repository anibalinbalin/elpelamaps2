"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { useParcelData } from "@/lib/use-parcel-data";
import { centroid, degToRad, formatAreaCompact } from "@/lib/geo-utils";
import { getTerrainDisplacementY } from "@/lib/mapbox-displacement-plugin";
import { useParcelSelection } from "@/lib/use-parcel-selection";
import { usePillPositions } from "@/lib/use-pill-positions";
import type { PillPosition } from "./parcel-pills";

interface ScreenProjectorProps {
  tilesRef: React.RefObject<any>;
}

export function ScreenProjector({ tilesRef }: ScreenProjectorProps) {
  const { camera, size } = useThree();
  const parcels = useParcelData({ includeDraftParcels: true });
  const selectedId = useParcelSelection((s) => s.selectedId);
  const updatePositions = usePillPositions((s) => s.update);
  const tempVec = useMemo(() => new Vector3(), []);
  const projVec = useMemo(() => new Vector3(), []);
  const lastPositions = useRef<PillPosition[] | null>(null);
  const lastSelectedPos = useRef<{ x: number; y: number } | null>(null);
  const lastUpdate = useRef(0);

  const parcelCentroids = useMemo(() => {
    return parcels.features.map((f) => {
      const ring = f.geometry.coordinates[0] as [number, number][];
      const [lon, lat] = centroid(ring);
      const { kicker, value } = splitParcelLabel(f.properties.id);
      return {
        id: f.properties.id,
        kicker,
        value,
        meta: formatAreaCompact(f.properties.areaSqMeters),
        latRad: degToRad(lat),
        lonRad: degToRad(lon),
      };
    });
  }, [parcels]);

  useFrame((state) => {
    const now = state.clock.elapsedTime;
    if (now - lastUpdate.current < 0.1) return;
    lastUpdate.current = now;

    try {
      const tiles = tilesRef.current;
      if (!tiles?.ellipsoid?.getCartographicToPosition || !tiles?.group) return;

      const positions: PillPosition[] = [];
      let selectedPos: { x: number; y: number } | null = null;

      for (const pc of parcelCentroids) {
        tiles.ellipsoid.getCartographicToPosition(pc.latRad, pc.lonRad, 50, tempVec);
        tempVec.applyMatrix4(tiles.group.matrixWorld);
        // Match GPU terrain displacement so pills float above the visual surface
        tempVec.y += getTerrainDisplacementY(tempVec.x, tempVec.z);
        projVec.copy(tempVec).project(camera);
        const x = Math.round((projVec.x * 0.5 + 0.5) * size.width);
        const y = Math.round((-projVec.y * 0.5 + 0.5) * size.height);
        const visible =
          projVec.z > -1 &&
          projVec.z < 1 &&
          x > -50 &&
          x < size.width + 50 &&
          y > -50 &&
          y < size.height + 50;
        positions.push({ id: pc.id, kicker: pc.kicker, value: pc.value, meta: pc.meta, x, y, visible });
        if (pc.id === selectedId) selectedPos = { x, y };
      }

      if (
        !pillPositionsChanged(lastPositions.current, positions) &&
        samePoint(lastSelectedPos.current, selectedPos)
      ) {
        return;
      }

      lastPositions.current = positions;
      lastSelectedPos.current = selectedPos;
      updatePositions(positions, selectedPos);
    } catch {
      // Skip during initialization
    }
  });

  return null;
}

function pillPositionsChanged(
  previous: PillPosition[] | null,
  next: PillPosition[],
) {
  if (!previous || previous.length !== next.length) {
    return true;
  }

  for (let index = 0; index < next.length; index += 1) {
    const prev = previous[index];
    const curr = next[index];

    if (
      prev.id !== curr.id ||
      prev.x !== curr.x ||
      prev.y !== curr.y ||
      prev.visible !== curr.visible
    ) {
      return true;
    }
  }

  return false;
}

function samePoint(
  previous: { x: number; y: number } | null,
  next: { x: number; y: number } | null,
) {
  if (previous === next) {
    return true;
  }

  if (!previous || !next) {
    return false;
  }

  return previous.x === next.x && previous.y === next.y;
}

function splitParcelLabel(id: string) {
  const label = id
    .replace(/[_-]+/g, " ")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  const parts = label.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return { kicker: parts[0], value: parts.slice(1).join(" ") };
  }
  return { kicker: "PARCEL", value: label };
}
