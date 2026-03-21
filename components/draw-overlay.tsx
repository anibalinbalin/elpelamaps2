"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Raycaster, Vector3 } from "three";
import { useDrawTool } from "@/lib/use-draw-tool";
import { create } from "zustand";

interface DrawPoint {
  x: number;
  y: number;
  visible: boolean;
}

interface DrawPositionsState {
  points: DrawPoint[];
  draggingIndex: number | null;
  update: (pts: DrawPoint[]) => void;
  setDragging: (index: number | null) => void;
}

export const useDrawPositions = create<DrawPositionsState>((set) => ({
  points: [],
  draggingIndex: null,
  update: (points) => set({ points }),
  setDragging: (draggingIndex) => set({ draggingIndex }),
}));

/**
 * R3F component that projects draw-tool vertices to screen coordinates.
 * Renders nothing — the DOM overlay reads from the store.
 * Mirrors ScreenProjector's pattern: recompute every ~100ms.
 */
export function DrawOverlay({ tilesRef }: { tilesRef: React.RefObject<any> }) {
  const vertices = useDrawTool((s) => s.vertices);
  const updatePositions = useDrawPositions((s) => s.update);
  const { camera, size } = useThree();
  const lastUpdate = useRef(0);
  const raycaster = useMemo(() => {
    const instance = new Raycaster();
    (instance as any).firstHitOnly = true;
    return instance;
  }, []);
  const tempVec = useMemo(() => new Vector3(), []);
  const normalVec = useMemo(() => new Vector3(), []);
  const rayOriginVec = useMemo(() => new Vector3(), []);
  const rayDirectionVec = useMemo(() => new Vector3(), []);
  const worldVec = useMemo(() => new Vector3(), []);
  const projVec = useMemo(() => new Vector3(), []);

  // Clear stale points on unmount
  useEffect(() => {
    return () => updatePositions([]);
  }, [updatePositions]);

  useFrame((state) => {
    const now = state.clock.elapsedTime;
    if (now - lastUpdate.current < 0.1) return;
    lastUpdate.current = now;

    const tiles = tilesRef.current;
    if (!tiles?.ellipsoid?.getCartographicToPosition || !tiles?.group) {
      return;
    }

    if (vertices.length === 0) {
      updatePositions([]);
      return;
    }

    const points = vertices.map(([lon, lat]) => {
      const lonRad = (lon * Math.PI) / 180;
      const latRad = (lat * Math.PI) / 180;
      projectCartographicToTerrainWorld(
        tiles,
        latRad,
        lonRad,
        raycaster,
        tempVec,
        normalVec,
        rayOriginVec,
        rayDirectionVec,
        worldVec,
      );
      projVec.copy(worldVec).project(camera);
      const x = (projVec.x * 0.5 + 0.5) * size.width;
      const y = (-projVec.y * 0.5 + 0.5) * size.height;
      const visible = projVec.z < 1 && x > -50 && x < size.width + 50 && y > -50 && y < size.height + 50;
      return { x, y, visible };
    });

    updatePositions(points);
  });

  return null;
}

function projectCartographicToTerrainWorld(
  tiles: any,
  latRad: number,
  lonRad: number,
  raycaster: Raycaster,
  localSurface: Vector3,
  localNormal: Vector3,
  rayOrigin: Vector3,
  rayDirection: Vector3,
  target: Vector3,
) {
  tiles.ellipsoid.getCartographicToPosition(latRad, lonRad, 0, localSurface);
  tiles.ellipsoid.getCartographicToNormal(latRad, lonRad, localNormal);

  rayOrigin.copy(localSurface).addScaledVector(localNormal, 10_000);
  rayOrigin.applyMatrix4(tiles.group.matrixWorld);
  rayDirection.copy(localNormal).transformDirection(tiles.group.matrixWorld).multiplyScalar(-1);

  raycaster.ray.origin.copy(rayOrigin);
  raycaster.ray.direction.copy(rayDirection);
  raycaster.near = 0;
  raycaster.far = 20_000;

  const hit = raycaster.intersectObject(tiles.group, true)[0];
  if (hit?.point) {
    target.copy(hit.point);
    return;
  }

  target.copy(localSurface).applyMatrix4(tiles.group.matrixWorld);
}

/** DOM overlay that draws vertex markers and connecting lines */
export function DrawOverlayDOM() {
  const points = useDrawPositions((s) => s.points);
  const draggingIndex = useDrawPositions((s) => s.draggingIndex);

  // Track which original indices are visible
  const visible: { point: DrawPoint; index: number }[] = [];
  for (let i = 0; i < points.length; i++) {
    if (points[i].visible) visible.push({ point: points[i], index: i });
  }

  if (visible.length === 0) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
    >
      {visible.length === 2 && (
        <polyline
          points={visible.map((v) => `${v.point.x},${v.point.y}`).join(" ")}
          fill="none"
          stroke="#00ffb4"
          strokeWidth={2}
        />
      )}
      {visible.map((v) => (
        <circle
          key={v.index}
          cx={v.point.x}
          cy={v.point.y}
          r={8}
          fill={draggingIndex === v.index ? "#00ffb4" : "white"}
          stroke="#00ffb4"
          strokeWidth={2}
        />
      ))}
    </svg>
  );
}
