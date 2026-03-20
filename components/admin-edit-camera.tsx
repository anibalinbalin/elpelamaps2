"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { useDrawTool } from "@/lib/use-draw-tool";
import { centroid, degToRad } from "@/lib/geo-utils";

interface AdminEditCameraProps {
  tilesRef: React.RefObject<any>;
}

export function AdminEditCamera({ tilesRef }: AdminEditCameraProps) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as any;
  const invalidate = useThree((state) => state.invalidate);
  const editingParcel = useDrawTool((state) => state.editingParcel);
  const lastAppliedId = useRef<string | null>(null);
  const localCenter = useMemo(() => new Vector3(), []);
  const worldCenter = useMemo(() => new Vector3(), []);
  const up = useMemo(() => new Vector3(), []);

  useFrame(() => {
    if (!editingParcel) {
      lastAppliedId.current = null;
      return;
    }

    if (lastAppliedId.current === editingParcel.properties.id) {
      return;
    }

    const tiles = tilesRef.current;
    if (!tiles?.ellipsoid?.getCartographicToPosition || !tiles?.group) {
      return;
    }

    const ring = editingParcel.geometry.coordinates[0] as [number, number][];
    const [lon, lat] = centroid(ring);

    tiles.ellipsoid.getCartographicToPosition(
      degToRad(lat),
      degToRad(lon),
      40,
      localCenter,
    );
    worldCenter.copy(localCenter).applyMatrix4(tiles.group.matrixWorld);

    if (controls?.getUpDirection) {
      controls.getUpDirection(worldCenter, up);
    } else {
      up.copy(worldCenter).normalize();
    }

    const altitude = Math.max(
      850,
      Math.min(1650, Math.sqrt(Math.max(editingParcel.properties.areaSqMeters, 1)) * 16),
    );

    camera.position.copy(worldCenter).addScaledVector(up, altitude);
    camera.up.copy(up);
    camera.lookAt(worldCenter);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();

    if (controls) {
      controls.pivotPoint?.copy?.(worldCenter);
      controls.zoomDelta = 0;
      controls.dragInertia?.set?.(0, 0, 0);
      controls.rotationInertia?.set?.(0, 0);
      controls.globeInertia?.identity?.();
      controls.needsUpdate = true;
    }

    invalidate();
    lastAppliedId.current = editingParcel.properties.id;
  });

  return null;
}
