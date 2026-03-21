"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, MathUtils } from "three";

interface CameraFlyInProps {
  tilesRef: React.RefObject<any>;
  targetLat: number;
  targetLon: number;
  altitude?: number;
  duration?: number;
}

export function CameraFlyIn({
  tilesRef,
  targetLat,
  targetLon,
  altitude = 5000,
  duration = 4,
}: CameraFlyInProps) {
  const { camera, invalidate } = useThree();
  const phase = useRef<"waiting" | "flying" | "done">("waiting");
  const startTime = useRef(0);
  const startPos = useRef(new Vector3());
  const targetPos = useRef(new Vector3());

  useFrame((state) => {
    if (phase.current === "done") return;

    const tiles = tilesRef.current;
    if (!tiles || !tiles.ellipsoid) return;

    if (phase.current === "waiting") {
      // Compute target position in ECEF, then apply the group transform
      tiles.ellipsoid.getCartographicToPosition(
        MathUtils.degToRad(targetLat),
        MathUtils.degToRad(targetLon),
        altitude,
        targetPos.current
      );
      // Apply the tiles group world matrix (handles Z-up to Y-up rotation)
      targetPos.current.applyMatrix4(tiles.group.matrixWorld);

      startPos.current.copy(camera.position);
      startTime.current = state.clock.elapsedTime;
      phase.current = "flying";
    }

    if (phase.current === "flying") {
      const elapsed = state.clock.elapsedTime - startTime.current;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);

      camera.position.lerpVectors(startPos.current, targetPos.current, eased);

      // Look toward the Earth's center (origin in the rotated group frame)
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();

      invalidate();

      if (t >= 1) {
        phase.current = "done";
      }
    }
  });

  return null;
}
