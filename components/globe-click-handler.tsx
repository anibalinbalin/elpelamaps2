"use client";

import { useCallback, useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { Camera, Matrix4, Raycaster, Vector2, Vector3, WebGLRenderer } from "three";
import { useParcelData } from "@/lib/use-parcel-data";
import { useDrawTool } from "@/lib/use-draw-tool";
import { useParcelSelection } from "@/lib/use-parcel-selection";
import { pointInPolygon } from "@/lib/point-in-polygon";
import { distanceMeters } from "@/lib/geo-utils";
import { useDrawPositions } from "./draw-overlay";

interface GlobeClickHandlerProps {
  tilesRef: React.RefObject<any>;
}

// Reuse these across calls to avoid GC pressure
const _raycaster = new Raycaster();
const _mouse = new Vector2();
const _inverseMatrix = new Matrix4();
const _localPoint = new Vector3();
const _latLon = { lat: 0, lon: 0 };

function raycastToLatLon(
  event: PointerEvent,
  camera: Camera,
  gl: WebGLRenderer,
  tiles: any,
): { lonDeg: number; latDeg: number } | null {
  try {
    if (!tiles?.group || !tiles?.ellipsoid?.getPositionToCartographic) return null;

    const rect = gl.domElement.getBoundingClientRect();
    _mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    _mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    _raycaster.setFromCamera(_mouse, camera);

    const intersects = _raycaster.intersectObject(tiles.group, true);
    if (intersects.length === 0) return null;

    const hit = intersects[0];
    _localPoint.copy(hit.point);
    _inverseMatrix.copy(tiles.group.matrixWorld).invert();
    _localPoint.applyMatrix4(_inverseMatrix);
    tiles.ellipsoid.getPositionToCartographic(_localPoint, _latLon);

    return {
      lonDeg: (_latLon.lon * 180) / Math.PI,
      latDeg: (_latLon.lat * 180) / Math.PI,
    };
  } catch {
    return null;
  }
}

const HOVER_THROTTLE_MS = 80;
const VERTEX_HIT_DISTANCE_METERS = 28;

export function GlobeClickHandler({ tilesRef }: GlobeClickHandlerProps) {
  const { camera, gl } = useThree();
  const parcels = useParcelData({ includeDraftParcels: true });
  const { select, hover } = useParcelSelection();
  const drawActive = useDrawTool((s) => s.active);
  const addVertex = useDrawTool((s) => s.addVertex);
  const moveVertex = useDrawTool((s) => s.moveVertex);
  const setDragging = useDrawPositions((s) => s.setDragging);
  const controls = useThree((s) => s.controls) as any;
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
  const lastHoverTime = useRef(0);
  const lastHoveredId = useRef<string | null>(null);

  const handleClick = useCallback(
    (event: PointerEvent) => {
      const draggingIndex = useDrawPositions.getState().draggingIndex;

      // If we were dragging a vertex, just release — don't add a new vertex
      if (draggingIndex !== null) {
        setDragging(null);
        if (controls) controls.enabled = true;
        return;
      }

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
    [camera, gl, tilesRef, parcels, select, drawActive, addVertex, setDragging, controls],
  );

  const handleMove = useCallback(
    (event: PointerEvent) => {
      const draggingIndex = useDrawPositions.getState().draggingIndex;

      // Handle vertex dragging
      if (draggingIndex !== null) {
        const result = raycastToLatLon(event, camera, gl, tilesRef.current);
        if (result) moveVertex(draggingIndex, result.lonDeg, result.latDeg);
        gl.domElement.style.cursor = "grabbing";
        return;
      }

      if (drawActive) {
        const result = raycastToLatLon(event, camera, gl, tilesRef.current);
        const nearVertex = result
          ? findNearestVertexIndex(
              [result.lonDeg, result.latDeg],
              useDrawTool.getState().vertices,
            ) !== null
          : false;
        gl.domElement.style.cursor = nearVertex ? "grab" : "crosshair";
        return;
      }

      // Skip hover raycasting while dragging — this is the biggest CPU saver
      if (event.buttons !== 0) {
        gl.domElement.style.cursor = "grabbing";
        return;
      }

      // Throttle hover checks
      const now = performance.now();
      if (now - lastHoverTime.current < HOVER_THROTTLE_MS) return;
      lastHoverTime.current = now;

      const result = raycastToLatLon(event, camera, gl, tilesRef.current);
      if (result) {
        for (const feature of parcels.features) {
          const ring = feature.geometry.coordinates[0] as [number, number][];
          if (pointInPolygon([result.lonDeg, result.latDeg], ring)) {
            if (lastHoveredId.current !== feature.properties.id) {
              lastHoveredId.current = feature.properties.id;
              hover(feature.properties.id);
            }
            gl.domElement.style.cursor = "pointer";
            return;
          }
        }
      }
      if (lastHoveredId.current !== null) {
        lastHoveredId.current = null;
        hover(null);
      }
      gl.domElement.style.cursor = "grab";
    },
    [camera, gl, tilesRef, parcels, hover, drawActive, moveVertex],
  );

  const handlePointerDown = useCallback(
    (event: PointerEvent) => {
      pointerDownPos.current = { x: event.clientX, y: event.clientY };

      // Check if pointerdown is near an existing vertex — start dragging
      if (drawActive) {
        const result = raycastToLatLon(event, camera, gl, tilesRef.current);
        if (result) {
          const hitIndex = findNearestVertexIndex(
            [result.lonDeg, result.latDeg],
            useDrawTool.getState().vertices,
          );
          if (hitIndex !== null) {
            setDragging(hitIndex);
            if (controls) controls.enabled = false;
            return;
          }
        }
      }
    },
    [camera, gl, tilesRef, drawActive, setDragging, controls],
  );

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

function findNearestVertexIndex(
  point: [number, number],
  vertices: [number, number][],
): number | null {
  let closestIndex: number | null = null;
  let closestDistance = Infinity;

  for (let i = 0; i < vertices.length; i++) {
    const distance = distanceMeters(point, vertices[i]);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = i;
    }
  }

  return closestDistance <= VERTEX_HIT_DISTANCE_METERS ? closestIndex : null;
}
