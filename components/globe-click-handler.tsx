"use client";

import { useCallback, useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { Camera, Matrix4, Raycaster, Vector2, WebGLRenderer } from "three";
import { useParcelData } from "@/lib/use-parcel-data";
import { useDrawTool } from "@/lib/use-draw-tool";
import { useParcelSelection } from "@/lib/use-parcel-selection";
import { pointInPolygon } from "@/lib/point-in-polygon";

interface GlobeClickHandlerProps {
  tilesRef: React.RefObject<any>;
}

function raycastToLatLon(
  event: PointerEvent,
  camera: Camera,
  gl: WebGLRenderer,
  tiles: any,
): { lonDeg: number; latDeg: number } | null {
  try {
    if (!tiles?.group || !tiles?.ellipsoid?.getPositionToCartographic) return null;

    const raycaster = new Raycaster();
    const mouse = new Vector2();
    const rect = gl.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObject(tiles.group, true);
    if (intersects.length === 0) return null;

    const hit = intersects[0];
    // hit.point is in world space; getPositionToCartographic expects ECEF local space
    const localPoint = hit.point.clone();
    const inverseMatrix = new Matrix4().copy(tiles.group.matrixWorld).invert();
    localPoint.applyMatrix4(inverseMatrix);
    const latLon: { lat: number; lon: number } = { lat: 0, lon: 0 };
    tiles.ellipsoid.getPositionToCartographic(localPoint, latLon);

    return {
      lonDeg: (latLon.lon * 180) / Math.PI,
      latDeg: (latLon.lat * 180) / Math.PI,
    };
  } catch {
    return null;
  }
}

export function GlobeClickHandler({ tilesRef }: GlobeClickHandlerProps) {
  const { camera, gl } = useThree();
  const parcels = useParcelData();
  const { select, hover } = useParcelSelection();
  const drawActive = useDrawTool((s) => s.active);
  const addVertex = useDrawTool((s) => s.addVertex);
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  const handleClick = useCallback(
    (event: PointerEvent) => {
      if (drawActive) {
        const down = pointerDownPos.current;
        if (down) {
          const dx = event.clientX - down.x;
          const dy = event.clientY - down.y;
          if (Math.sqrt(dx * dx + dy * dy) > 5) return; // was a drag
        }
        const result = raycastToLatLon(event, camera, gl, tilesRef.current);
        if (result) addVertex(result.lonDeg, result.latDeg);
        return;
      }

      const result = raycastToLatLon(event, camera, gl, tilesRef.current);
      if (result) {
        for (const feature of parcels.features) {
          const ring = feature.geometry.coordinates[0] as [number, number][];
          if (pointInPolygon([result.lonDeg, result.latDeg], ring)) {
            select(feature.properties);
            return;
          }
        }
      }
      select(null);
    },
    [camera, gl, tilesRef, parcels, select, drawActive, addVertex],
  );

  const handleMove = useCallback(
    (event: PointerEvent) => {
      if (drawActive) {
        gl.domElement.style.cursor = "crosshair";
        return;
      }

      const result = raycastToLatLon(event, camera, gl, tilesRef.current);
      if (result) {
        for (const feature of parcels.features) {
          const ring = feature.geometry.coordinates[0] as [number, number][];
          if (pointInPolygon([result.lonDeg, result.latDeg], ring)) {
            hover(feature.properties.id);
            gl.domElement.style.cursor = "pointer";
            return;
          }
        }
      }
      hover(null);
      gl.domElement.style.cursor = "grab";
    },
    [camera, gl, tilesRef, parcels, hover, drawActive],
  );

  const handlePointerDown = useCallback((event: PointerEvent) => {
    pointerDownPos.current = { x: event.clientX, y: event.clientY };
  }, []);

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointerup", handleClick);
    canvas.addEventListener("pointermove", handleMove);
    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointerup", handleClick);
      canvas.removeEventListener("pointermove", handleMove);
    };
  }, [gl, handlePointerDown, handleClick, handleMove]);

  return null;
}
