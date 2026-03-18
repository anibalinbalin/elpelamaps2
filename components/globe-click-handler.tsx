"use client";

import { useCallback, useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Camera, Raycaster, Vector2, WebGLRenderer } from "three";
import { getParcels } from "@/lib/parcels";
import { useParcelSelection } from "@/lib/use-parcel-selection";
import { pointInPolygon } from "@/lib/point-in-polygon";

interface GlobeClickHandlerProps {
  tilesRef: React.RefObject<any>;
}

function raycastToLatLon(
  event: PointerEvent,
  camera: Camera,
  gl: WebGLRenderer,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tiles: any,
): { lonDeg: number; latDeg: number } | null {
  if (!tiles) return null;

  const raycaster = new Raycaster();
  const mouse = new Vector2();
  const rect = gl.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObject(tiles.group, true);
  if (intersects.length === 0) return null;

  const hit = intersects[0];
  const latLon: { lat: number; lon: number } = { lat: 0, lon: 0 };
  tiles.ellipsoid.getPositionToCartographic(hit.point, latLon);

  return {
    lonDeg: (latLon.lon * 180) / Math.PI,
    latDeg: (latLon.lat * 180) / Math.PI,
  };
}

export function GlobeClickHandler({ tilesRef }: GlobeClickHandlerProps) {
  const { camera, gl } = useThree();
  const parcels = getParcels();
  const { select, hover } = useParcelSelection();

  const handleClick = useCallback(
    (event: PointerEvent) => {
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
    [camera, gl, tilesRef, parcels, select],
  );

  const handleMove = useCallback(
    (event: PointerEvent) => {
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
    [camera, gl, tilesRef, parcels, hover],
  );

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener("pointerup", handleClick);
    canvas.addEventListener("pointermove", handleMove);
    return () => {
      canvas.removeEventListener("pointerup", handleClick);
      canvas.removeEventListener("pointermove", handleMove);
    };
  }, [gl, handleClick, handleMove]);

  return null;
}
