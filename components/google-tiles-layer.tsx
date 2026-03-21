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
  type TileReliefPreset,
} from "@/lib/constants";
import { MapboxDisplacementPlugin } from "@/lib/mapbox-displacement-plugin";
import { TileReliefPlugin } from "@/lib/tile-relief-plugin";

interface TilesLayerProps {
  apiToken: string;
  children?: React.ReactNode;
  terrainDisplacementScale?: number;
  tileRelief?: TileReliefPreset;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ECEF_ROTATION: any = {
  rotation: new Euler(-Math.PI / 2, 0, 0),
};
const CESIUM_GOOGLE_3D_TILES = 2275207;
const localCameraPosition = new Vector3();
const prevCameraPosition = new Vector3();

/** Slightly reduce tile streaming budget while camera is moving to free up GPU/CPU. */
const MOVING_BUDGET = {
  errorTarget: 28,
  maxTilesProcessed: 64,
  parseJobs: 4,
  downloadJobs: 8,
} as const;

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
  tilesRef,
}: {
  controlsRef: RefObject<any>;
  tilesRef: RefObject<any>;
}) {
  const settledFrames = useRef(0);
  const isMovingBudget = useRef(false);

  useFrame(({ camera }) => {
    const controls = controlsRef.current;

    if (!controls) {
      return;
    }

    // Dynamic tile budget: reduce while moving, restore when settled
    const tiles = tilesRef.current;
    if (tiles) {
      const moved = prevCameraPosition.distanceToSquared(camera.position) > 0.01;
      prevCameraPosition.copy(camera.position);

      if (moved) {
        settledFrames.current = 0;
        if (!isMovingBudget.current) {
          isMovingBudget.current = true;
          tiles.errorTarget = MOVING_BUDGET.errorTarget;
          tiles.maxTilesProcessed = MOVING_BUDGET.maxTilesProcessed;
          tiles.parseQueue.maxJobs = MOVING_BUDGET.parseJobs;
          tiles.downloadQueue.maxJobs = MOVING_BUDGET.downloadJobs;
        }
      } else {
        settledFrames.current += 1;
        // Wait ~30 frames (~0.5s) after settling before restoring full budget
        if (isMovingBudget.current && settledFrames.current > 30) {
          isMovingBudget.current = false;
          tiles.errorTarget = TILE_STREAMING_BUDGET.errorTarget;
          tiles.maxTilesProcessed = TILE_STREAMING_BUDGET.maxTilesProcessed;
          tiles.parseQueue.maxJobs = TILE_STREAMING_BUDGET.parseJobs;
          tiles.downloadQueue.maxJobs = TILE_STREAMING_BUDGET.downloadJobs;
        }
      }
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

    // Gradually damp inertia instead of killing it instantly to avoid jank
    if (controls.dragInertia) {
      controls.dragInertia.multiplyScalar(0.5);
    }
    if (controls.rotationInertia) {
      controls.rotationInertia.multiplyScalar(0.5);
    }
    controls.globeInertia?.identity?.();
  });

  return null;
}

export const GoogleTilesLayer = forwardRef<any, TilesLayerProps>(
  function GoogleTilesLayer(
    {
      apiToken,
      children,
      terrainDisplacementScale = 3.05,
      tileRelief,
    },
    ref,
  ) {
    const cesiumToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    const controlsRef = useRef<any>(null);
    const internalTilesRef = useRef<any>(null);

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

      internalTilesRef.current = instance;

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
        <TilesPlugin
          plugin={TileReliefPlugin}
          args={[{}]}
          lightDirection={tileRelief?.lightDirection}
          ambient={tileRelief?.ambient}
          wrap={tileRelief?.wrap}
          directionalStrength={tileRelief?.directionalStrength}
          shadowStrength={tileRelief?.shadowStrength}
          topLight={tileRelief?.topLight}
          curvatureStrength={tileRelief?.curvatureStrength}
          curvatureScale={tileRelief?.curvatureScale}
          rimStrength={tileRelief?.rimStrength}
        />
        {mapboxToken && (
          <TilesPlugin
            plugin={MapboxDisplacementPlugin}
            args={[{
              token: mapboxToken,
              centerLat: JOSE_IGNACIO_CENTER.lat,
              centerLon: JOSE_IGNACIO_CENTER.lon,
              zoom: 12,
            }]}
            scale={terrainDisplacementScale}
          />
        )}
        <GlobeControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.12}
          rotationSpeed={3}
          zoomSpeed={1}
          farMargin={0.05}
          minDistance={VIEW_TRAVEL_LIMITS.minDistance}
          maxDistance={VIEW_TRAVEL_LIMITS.maxDistance}
        />
        <TravelGuard controlsRef={controlsRef} tilesRef={internalTilesRef} />
        <TilesAttributionOverlay />
        <CompassGizmo />

        {children}
      </TilesRenderer>
    );
  }
);
