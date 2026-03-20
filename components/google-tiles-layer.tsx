"use client";

import {
  forwardRef,
  useCallback,
  useRef,
  type RefObject,
} from "react";
import { useFrame } from "@react-three/fiber";
import { Euler, MathUtils, Vector3 } from "three";
import { TilesRenderer, TilesPlugin, GlobeControls, TilesAttributionOverlay, CompassGizmo } from "3d-tiles-renderer/r3f";
import {
  GoogleCloudAuthPlugin,
  UpdateOnChangePlugin,
  TileCompressionPlugin,
  ReorientationPlugin,
} from "3d-tiles-renderer/plugins";
import { CesiumIonAuthPlugin } from "3d-tiles-renderer/core/plugins";
import {
  JOSE_IGNACIO_CENTER,
  TILE_STREAMING_BUDGET,
  VIEW_TRAVEL_LIMITS,
} from "@/lib/constants";
import { MapboxDisplacementPlugin } from "@/lib/mapbox-displacement-plugin";

interface TilesLayerProps {
  apiToken: string;
  children?: React.ReactNode;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ECEF_ROTATION: any = {
  rotation: new Euler(-Math.PI / 2, 0, 0),
};
const CESIUM_GOOGLE_3D_TILES = 2275207;
const localCameraPosition = new Vector3();

function clampHorizontalTravel(point: Vector3, maxHorizontalDistance: number): boolean {
  let changed = false;
  const horizontalDistance = Math.hypot(point.x, point.z);

  if (horizontalDistance > maxHorizontalDistance) {
    const scale = maxHorizontalDistance / horizontalDistance;
    point.x *= scale;
    point.z *= scale;
    changed = true;
  }

  return changed;
}

function clampCameraPoint(point: Vector3): boolean {
  let changed = clampHorizontalTravel(
    point,
    VIEW_TRAVEL_LIMITS.maxHorizontalDistance,
  );

  const clampedHeight = MathUtils.clamp(
    point.y,
    VIEW_TRAVEL_LIMITS.minHeight,
    VIEW_TRAVEL_LIMITS.maxHeight,
  );
  if (clampedHeight !== point.y) {
    point.y = clampedHeight;
    changed = true;
  }

  return changed;
}

function TravelGuard({
  controlsRef,
}: {
  controlsRef: RefObject<any>;
}) {
  useFrame(({ camera }) => {
    const controls = controlsRef.current;

    if (!controls) {
      return;
    }

    let clamped = false;

    localCameraPosition.copy(camera.position);
    if (clampCameraPoint(localCameraPosition)) {
      camera.position.copy(localCameraPosition);
      clamped = true;
    }

    if (!clamped) {
      return;
    }

    camera.updateMatrixWorld();

    controls.zoomDelta = 0;
    controls.needsUpdate = true;

    // Do not reset the controls while a pointer is active. That clears the
    // internal pointer tracker mid-drag and makes the globe appear to "die"
    // until the next interaction begins.
    if ((controls.pointerTracker?.getPointerCount?.() ?? 0) > 0) {
      return;
    }

    controls.dragInertia?.set?.(0, 0, 0);
    controls.rotationInertia?.set?.(0, 0);
    controls.globeInertia?.identity?.();
    controls.resetState();
  });

  return null;
}

export const GoogleTilesLayer = forwardRef<any, TilesLayerProps>(
  function GoogleTilesLayer({ apiToken, children }, ref) {
    const cesiumToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    const controlsRef = useRef<any>(null);

    const authPlugin = cesiumToken
      ? { plugin: CesiumIonAuthPlugin, args: [{ apiToken: cesiumToken, assetId: CESIUM_GOOGLE_3D_TILES, autoRefreshToken: true }] }
      : { plugin: GoogleCloudAuthPlugin, args: [{ apiToken, autoRefreshToken: true }] };

    const setTilesRendererRef = useCallback((instance: any | null) => {
      if (instance) {
        instance.errorTarget = TILE_STREAMING_BUDGET.errorTarget;
        instance.loadSiblings = TILE_STREAMING_BUDGET.loadSiblings;
        instance.maxTilesProcessed = TILE_STREAMING_BUDGET.maxTilesProcessed;
        instance.parseQueue.maxJobs = TILE_STREAMING_BUDGET.parseJobs;
        instance.downloadQueue.maxJobs = TILE_STREAMING_BUDGET.downloadJobs;
      }

      if (typeof ref === "function") {
        ref(instance);
      } else if (ref) {
        ref.current = instance;
      }
    }, [ref]);

    return (
      <TilesRenderer ref={setTilesRendererRef} group={ECEF_ROTATION}>
        <TilesPlugin plugin={authPlugin.plugin} args={authPlugin.args} />
        <TilesPlugin
          plugin={ReorientationPlugin}
          args={[{
            lat: MathUtils.degToRad(JOSE_IGNACIO_CENTER.lat),
            lon: MathUtils.degToRad(JOSE_IGNACIO_CENTER.lon),
            height: 0,
            recenter: true,
          }]}
        />
        <TilesPlugin plugin={UpdateOnChangePlugin} />
        <TilesPlugin plugin={TileCompressionPlugin} />
        {mapboxToken && (
          <TilesPlugin
            plugin={MapboxDisplacementPlugin}
            args={[{
              token: mapboxToken,
              centerLat: JOSE_IGNACIO_CENTER.lat,
              centerLon: JOSE_IGNACIO_CENTER.lon,
              scale: 2.2,
              zoom: 12,
            }]}
          />
        )}
        <GlobeControls
          ref={controlsRef}
          enableDamping
          farMargin={0.05}
          minDistance={VIEW_TRAVEL_LIMITS.minDistance}
          maxDistance={VIEW_TRAVEL_LIMITS.maxDistance}
        />
        <TravelGuard controlsRef={controlsRef} />
        <TilesAttributionOverlay />
        <CompassGizmo />

        {children}
      </TilesRenderer>
    );
  }
);
