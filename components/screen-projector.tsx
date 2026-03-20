"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { useParcelData } from "@/lib/use-parcel-data";
import { centroid, degToRad, formatAreaCompact } from "@/lib/geo-utils";
import { useParcelSelection } from "@/lib/use-parcel-selection";
import { usePillPositions } from "@/lib/use-pill-positions";
import type { PillPosition } from "./parcel-pills";

interface ScreenProjectorProps {
  tilesRef: React.RefObject<any>;
}

export function ScreenProjector({ tilesRef }: ScreenProjectorProps) {
  const { camera, size } = useThree();
  const parcels = useParcelData();
  const selectedId = useParcelSelection((s) => s.selectedId);
  const updatePositions = usePillPositions((s) => s.update);
  const tempVec = useMemo(() => new Vector3(), []);
  const projVec = useMemo(() => new Vector3(), []);
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
    try {
      const now = state.clock.elapsedTime;
      if (now - lastUpdate.current < 0.1) return;
      lastUpdate.current = now;

      const tiles = tilesRef.current;
      if (!tiles?.ellipsoid?.getCartographicToPosition || !tiles?.group) return;

      const positions: PillPosition[] = [];
      let selectedPos: { x: number; y: number } | null = null;

      for (const pc of parcelCentroids) {
        tiles.ellipsoid.getCartographicToPosition(pc.latRad, pc.lonRad, 50, tempVec);
        tempVec.applyMatrix4(tiles.group.matrixWorld);
        projVec.copy(tempVec).project(camera);
        const x = (projVec.x * 0.5 + 0.5) * size.width;
        const y = (-projVec.y * 0.5 + 0.5) * size.height;
        const visible = projVec.z < 1 && x > -50 && x < size.width + 50 && y > -50 && y < size.height + 50;
        positions.push({ id: pc.id, kicker: pc.kicker, value: pc.value, meta: pc.meta, x, y, visible });
        if (pc.id === selectedId) selectedPos = { x, y };
      }

      updatePositions(positions, selectedPos);
    } catch {
      // Skip during initialization
    }
  });

  return null;
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
