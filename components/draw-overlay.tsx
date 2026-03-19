"use client";

import { useDrawTool } from "@/lib/use-draw-tool";
import { useMemo } from "react";
import { Vector3 } from "three";
import { Line } from "@react-three/drei";

export function DrawOverlay({ tilesRef }: { tilesRef: React.RefObject<any> }) {
  const vertices = useDrawTool((s) => s.vertices);

  const positions = useMemo(() => {
    const tiles = tilesRef.current;
    if (!tiles || !tiles.ellipsoid || vertices.length === 0) return [];

    return vertices.map(([lon, lat]) => {
      const tempVec = new Vector3();
      const lonRad = (lon * Math.PI) / 180;
      const latRad = (lat * Math.PI) / 180;
      tiles.ellipsoid.getCartographicToPosition(latRad, lonRad, 50, tempVec);
      tempVec.applyMatrix4(tiles.group.matrixWorld);
      return [tempVec.x, tempVec.y, tempVec.z] as [number, number, number];
    });
  }, [vertices, tilesRef]);

  if (positions.length === 0) return null;

  return (
    <group>
      {positions.map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[15, 8, 8]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}

      {positions.length >= 2 && (
        <Line points={positions} color="#00ffb4" lineWidth={2} />
      )}
    </group>
  );
}
