"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { useParcelSelection } from "@/lib/use-parcel-selection";
import { useParcelData } from "@/lib/use-parcel-data";
import { centroid, degToRad } from "@/lib/geo-utils";

interface ParcelCameraFlyProps {
  tilesRef: React.RefObject<any>;
}

const DURATION = 1.5;

export function ParcelCameraFly({ tilesRef }: ParcelCameraFlyProps) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as any;
  const invalidate = useThree((state) => state.invalidate);

  const selectedId = useParcelSelection((s) => s.selectedId);
  const parcels = useParcelData();

  const phase = useRef<"idle" | "flying">("idle");
  const startTime = useRef(0);
  const startPos = useRef(new Vector3());
  const targetPos = useRef(new Vector3());
  const lookTarget = useRef(new Vector3());
  const startLookTarget = useRef(new Vector3());
  const lastAnimatedId = useRef<string | null>(null);

  const localCenter = useMemo(() => new Vector3(), []);
  const worldCenter = useMemo(() => new Vector3(), []);
  const up = useMemo(() => new Vector3(), []);
  const side = useMemo(() => new Vector3(), []);
  const interpLook = useMemo(() => new Vector3(), []);
  const tempForward = useMemo(() => new Vector3(), []);

  useEffect(() => {
    if (!selectedId) {
      lastAnimatedId.current = null;
      phase.current = "idle";
      return;
    }

    if (selectedId === lastAnimatedId.current) return;

    const feature = parcels.features.find(
      (f) => f.properties.id === selectedId,
    );
    if (!feature) return;

    const tiles = tilesRef.current;
    if (!tiles?.ellipsoid?.getCartographicToPosition || !tiles?.group) return;

    const ring = feature.geometry.coordinates[0] as [number, number][];
    const [lon, lat] = centroid(ring);

    // Compute world position of parcel center at ground level
    tiles.ellipsoid.getCartographicToPosition(
      degToRad(lat),
      degToRad(lon),
      0,
      localCenter,
    );
    worldCenter.copy(localCenter).applyMatrix4(tiles.group.matrixWorld);

    // Get the "up" direction at this location
    if (controls?.getUpDirection) {
      controls.getUpDirection(worldCenter, up);
    } else {
      up.copy(worldCenter).normalize();
    }

    // Compute altitude based on parcel area
    const area = Math.max(feature.properties.areaSqMeters, 1);
    const altitude = Math.max(600, Math.min(1200, Math.sqrt(area) * 12));

    // Create a side vector perpendicular to "up" for the cinematic tilt
    // Use camera's current right direction as a hint for the offset
    side.set(1, 0, 0);
    if (Math.abs(up.dot(side)) > 0.9) side.set(0, 0, 1);
    side.crossVectors(up, side).normalize();

    // Position: above and offset to the side for ~30° tilt
    const tiltOffset = altitude * 0.5;
    targetPos.current
      .copy(worldCenter)
      .addScaledVector(up, altitude)
      .addScaledVector(side, tiltOffset);

    lookTarget.current.copy(worldCenter);
    startPos.current.copy(camera.position);

    // Capture where camera is currently looking
    tempForward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    startLookTarget.current
      .copy(camera.position)
      .addScaledVector(tempForward, worldCenter.distanceTo(camera.position));

    lastAnimatedId.current = selectedId;
    startTime.current = -1; // Will be set on first frame
    phase.current = "flying";
  }, [
    selectedId,
    parcels,
    tilesRef,
    camera,
    controls,
    localCenter,
    worldCenter,
    up,
    side,
  ]);

  useFrame((state) => {
    if (phase.current !== "flying") return;

    // Cancel if user is interacting
    if (controls?.pointerTracker?.getPointerCount?.() > 0) {
      phase.current = "idle";
      return;
    }

    if (startTime.current < 0) {
      startTime.current = state.clock.elapsedTime;
    }

    const elapsed = state.clock.elapsedTime - startTime.current;
    const t = Math.min(elapsed / DURATION, 1);
    // Ease-out cubic
    const eased = 1 - Math.pow(1 - t, 3);

    // Interpolate position
    camera.position.lerpVectors(startPos.current, targetPos.current, eased);

    // Interpolate look target
    interpLook.lerpVectors(startLookTarget.current, lookTarget.current, eased);
    camera.lookAt(interpLook);
    camera.updateProjectionMatrix();

    // Reset controls inertia to prevent fighting
    if (controls) {
      controls.zoomDelta = 0;
      controls.dragInertia?.set?.(0, 0, 0);
      controls.rotationInertia?.set?.(0, 0);
      controls.globeInertia?.identity?.();
      controls.needsUpdate = true;
    }

    invalidate();

    if (t >= 1) {
      // Set pivot so orbit controls rotate around the parcel
      controls?.pivotPoint?.copy?.(lookTarget.current);
      phase.current = "idle";
    }
  });

  return null;
}
