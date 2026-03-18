"use client";

import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, MathUtils } from "three";

interface CameraFlyInProps {
  tilesRef: React.RefObject<any>;
  targetLat: number; // degrees
  targetLon: number; // degrees
  duration?: number; // seconds
}

export function CameraFlyIn({
  tilesRef,
  targetLat,
  targetLon,
  duration = 3,
}: CameraFlyInProps) {
  const { camera } = useThree();
  const startTime = useRef<number | null>(null);
  const startPos = useRef(new Vector3());
  const targetPos = useRef(new Vector3());
  const done = useRef(false);

  useEffect(() => {
    startPos.current.copy(camera.position);
  }, [camera]);

  useFrame((state) => {
    if (done.current) return;
    const tiles = tilesRef.current;
    if (!tiles || !tiles.ellipsoid) return;

    if (startTime.current === null) {
      startTime.current = state.clock.elapsedTime;
      tiles.ellipsoid.getCartographicToPosition(
        MathUtils.degToRad(targetLat),
        MathUtils.degToRad(targetLon),
        3000, // 3km altitude
        targetPos.current
      );
      targetPos.current.applyMatrix4(tiles.group.matrixWorld);
    }

    const elapsed = state.clock.elapsedTime - startTime.current;
    const t = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic

    camera.position.lerpVectors(startPos.current, targetPos.current, eased);
    camera.lookAt(0, 0, 0);

    if (t >= 1) done.current = true;
    state.invalidate();
  });

  return null;
}
