"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { useDrawTool } from "@/lib/use-draw-tool";
import { create } from "zustand";

interface DrawPoint {
  x: number;
  y: number;
  visible: boolean;
}

interface DrawPositionsState {
  points: DrawPoint[];
  update: (pts: DrawPoint[]) => void;
}

export const useDrawPositions = create<DrawPositionsState>((set) => ({
  points: [],
  update: (points) => set({ points }),
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
  const tempVec = useMemo(() => new Vector3(), []);

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
      tiles.ellipsoid.getCartographicToPosition(latRad, lonRad, 50, tempVec);
      tempVec.applyMatrix4(tiles.group.matrixWorld);
      const projected = tempVec.clone().project(camera);
      const x = (projected.x * 0.5 + 0.5) * size.width;
      const y = (-projected.y * 0.5 + 0.5) * size.height;
      const visible = projected.z < 1 && x > -50 && x < size.width + 50 && y > -50 && y < size.height + 50;
      return { x, y, visible };
    });

    updatePositions(points);
  });

  return null;
}

/** DOM overlay that draws vertex markers and connecting lines */
export function DrawOverlayDOM() {
  const points = useDrawPositions((s) => s.points);
  const visiblePoints = points.filter((p) => p.visible);

  if (visiblePoints.length === 0) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
    >
      {visiblePoints.length >= 3 && (
        <polygon
          points={visiblePoints.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="rgba(0, 255, 180, 0.15)"
          stroke="#00ffb4"
          strokeWidth={2}
          strokeLinejoin="round"
        />
      )}
      {visiblePoints.length === 2 && (
        <polyline
          points={visiblePoints.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="#00ffb4"
          strokeWidth={2}
        />
      )}
      {visiblePoints.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={6}
          fill="white"
          stroke="#00ffb4"
          strokeWidth={2}
        />
      ))}
    </svg>
  );
}
