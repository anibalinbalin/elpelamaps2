"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { getParcels } from "@/lib/parcels";
import { centroid, degToRad } from "@/lib/geo-utils";
import { useParcelSelection } from "@/lib/use-parcel-selection";
import { usePillPositions } from "@/lib/use-pill-positions";
import type { PillPosition } from "./parcel-pills";

interface ScreenProjectorProps {
  tilesRef: React.RefObject<any>;
}

export function ScreenProjector({ tilesRef }: ScreenProjectorProps) {
  const { camera, size } = useThree();
  const parcels = useMemo(() => getParcels(), []);
  const selectedId = useParcelSelection((s) => s.selectedId);
  const updatePositions = usePillPositions((s) => s.update);
  const tempVec = useMemo(() => new Vector3(), []);
  const lastUpdate = useRef(0);

  const parcelCentroids = useMemo(() => {
    return parcels.features.map((f) => {
      const ring = f.geometry.coordinates[0] as [number, number][];
      const [lon, lat] = centroid(ring);
      return { id: f.properties.id, name: f.properties.name, latRad: degToRad(lat), lonRad: degToRad(lon) };
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
        const projected = tempVec.clone().project(camera);
        const x = (projected.x * 0.5 + 0.5) * size.width;
        const y = (-projected.y * 0.5 + 0.5) * size.height;
        const visible = projected.z < 1 && x > -50 && x < size.width + 50 && y > -50 && y < size.height + 50;
        positions.push({ id: pc.id, name: pc.name, x, y, visible });
        if (pc.id === selectedId) selectedPos = { x, y };
      }

      updatePositions(positions, selectedPos);
    } catch {
      // Skip during initialization
    }
  });

  return null;
}
