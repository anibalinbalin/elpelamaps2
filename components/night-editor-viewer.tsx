"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Cartesian2,
  Cartesian3,
  Cartesian4,
  Color,
  Viewer,
  createGooglePhotorealistic3DTileset,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  HeightReference,
  Math as CesiumMath,
  type Cesium3DTileset,
  type Entity,
} from "cesium";
import { NIGHT_SHADER, MAX_EXCLUSION_ZONES, applyNightMode } from "@/lib/night-mode";
import { NightTuner } from "./night-tuner";
import { GOOGLE_MAPS_API_KEY, JOSE_IGNACIO_CENTER } from "@/lib/constants";

declare global {
  interface Window {
    CESIUM_BASE_URL?: string;
  }
}

interface ExclusionZone {
  id: string;
  position: Cartesian3; // ECEF
  radius: number;
  entity: Entity;
}

export function NightEditorViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const tilesetRef = useRef<Cesium3DTileset | null>(null);
  const nightCleanupRef = useRef<(() => void) | null>(null);
  const handlerRef = useRef<ScreenSpaceEventHandler | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState("");
  const [addMode, setAddMode] = useState(false);
  const [radius, setRadius] = useState(100);
  const [zones, setZones] = useState<ExclusionZone[]>([]);
  const zonesRef = useRef<ExclusionZone[]>([]);

  // Keep ref in sync
  zonesRef.current = zones;

  const syncShaderUniforms = useCallback((currentZones: ExclusionZone[]) => {
    for (let i = 0; i < MAX_EXCLUSION_ZONES; i++) {
      const zone = currentZones[i];
      if (zone) {
        NIGHT_SHADER.setUniform(
          `u_exclude${i}`,
          new Cartesian4(zone.position.x, zone.position.y, zone.position.z, zone.radius),
        );
      } else {
        NIGHT_SHADER.setUniform(`u_exclude${i}`, new Cartesian4(0, 0, 0, 0));
      }
    }
  }, []);

  const addZone = useCallback(
    (position: Cartesian3, r: number) => {
      const viewer = viewerRef.current;
      if (!viewer || zonesRef.current.length >= MAX_EXCLUSION_ZONES) return;

      const entity = viewer.entities.add({
        position,
        ellipse: {
          semiMajorAxis: r,
          semiMinorAxis: r,
          material: Color.RED.withAlpha(0.25),
          outline: true,
          outlineColor: Color.RED.withAlpha(0.7),
          outlineWidth: 2,
          heightReference: HeightReference.CLAMP_TO_GROUND,
        },
      });

      const zone: ExclusionZone = {
        id: crypto.randomUUID(),
        position,
        radius: r,
        entity,
      };

      const newZones = [...zonesRef.current, zone];
      setZones(newZones);
      syncShaderUniforms(newZones);
    },
    [syncShaderUniforms],
  );

  const removeZone = useCallback(
    (zoneId: string) => {
      const viewer = viewerRef.current;
      if (!viewer) return;
      const zone = zonesRef.current.find((z) => z.id === zoneId);
      if (zone) {
        viewer.entities.remove(zone.entity);
      }
      const newZones = zonesRef.current.filter((z) => z.id !== zoneId);
      setZones(newZones);
      syncShaderUniforms(newZones);
    },
    [syncShaderUniforms],
  );

  const clearAll = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    for (const zone of zonesRef.current) {
      viewer.entities.remove(zone.entity);
    }
    setZones([]);
    syncShaderUniforms([]);
  }, [syncShaderUniforms]);

  // Initialize Cesium
  useEffect(() => {
    if (!containerRef.current) return;

    const googleApiKey = GOOGLE_MAPS_API_KEY;
    if (!googleApiKey) {
      setError("Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local");
      return;
    }

    window.CESIUM_BASE_URL = "/Cesium/";
    let disposed = false;
    let loadTilesetFrameId: number | null = null;

    const viewer = new Viewer(containerRef.current, {
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      vrButton: false,
      requestRenderMode: false,
      shadows: false,
    });

    viewer.scene.backgroundColor = Color.BLACK;
    viewer.scene.globe.baseColor = Color.TRANSPARENT;
    viewer.scene.globe.showGroundAtmosphere = true;
    viewer.scene.globe.imageryLayers.removeAll();
    viewer.postProcessStages.fxaa.enabled = true;

    const controller = viewer.scene.screenSpaceCameraController;
    controller.maximumZoomDistance = 10000;
    controller.minimumZoomDistance = 50;
    controller.enableCollisionDetection = true;

    viewerRef.current = viewer;

    // Fly to Jose Ignacio area
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(
        JOSE_IGNACIO_CENTER.lon,
        JOSE_IGNACIO_CENTER.lat,
        1500,
      ),
      orientation: {
        heading: CesiumMath.toRadians(0),
        pitch: CesiumMath.toRadians(-45),
        roll: 0,
      },
      duration: 0,
    });

    // Load tileset
    loadTilesetFrameId = window.requestAnimationFrame(() => {
      void (async () => {
        try {
          const tileset = await createGooglePhotorealistic3DTileset({
            key: googleApiKey,
            onlyUsingWithGoogleGeocoder: true,
          });
          if (disposed) return;

          tilesetRef.current = tileset;
          viewer.scene.primitives.add(tileset);

          // Apply night mode immediately
          nightCleanupRef.current = applyNightMode(viewer, tilesetRef);

          tileset.initialTilesLoaded.addEventListener(() => {
            if (!disposed) setIsReady(true);
          });
          if (tileset.tilesLoaded) setIsReady(true);
        } catch (loadError) {
          if (!disposed) {
            setError(
              loadError instanceof Error
                ? loadError.message
                : "Could not load Google Photorealistic 3D Tiles.",
            );
          }
        }
      })();
    });

    return () => {
      disposed = true;
      nightCleanupRef.current?.();
      nightCleanupRef.current = null;
      if (loadTilesetFrameId != null) {
        window.cancelAnimationFrame(loadTilesetFrameId);
      }
      handlerRef.current?.destroy();
      handlerRef.current = null;
      if (!viewer.isDestroyed()) {
        viewer.destroy();
      }
      viewerRef.current = null;
      tilesetRef.current = null;
    };
  }, []);

  // Click handler for add/remove zones
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    // Clean up previous handler
    handlerRef.current?.destroy();

    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handlerRef.current = handler;

    handler.setInputAction(
      (click: { position: { x: number; y: number } }) => {
        if (!viewer || viewer.isDestroyed()) return;

        // Check if clicking an existing zone entity to delete
        const screenPos = new Cartesian2(click.position.x, click.position.y);
        const pickedObject = viewer.scene.pick(screenPos);
        if (pickedObject?.id) {
          const clickedEntity = pickedObject.id as Entity;
          const matchedZone = zonesRef.current.find(
            (z) => z.entity === clickedEntity,
          );
          if (matchedZone) {
            removeZone(matchedZone.id);
            return;
          }
        }

        // If in add mode, place a new zone
        if (addMode && zonesRef.current.length < MAX_EXCLUSION_ZONES) {
          const position = viewer.scene.pickPosition(screenPos);
          if (position) {
            addZone(position, radius);
          }
        }
      },
      ScreenSpaceEventType.LEFT_CLICK,
    );

    return () => {
      handler.destroy();
      if (handlerRef.current === handler) {
        handlerRef.current = null;
      }
    };
  }, [addMode, radius, addZone, removeZone]);

  return (
    <div className="relative h-screen w-screen bg-black">
      {error && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black text-red-400">
          {error}
        </div>
      )}

      <div ref={containerRef} className="h-full w-full" />

      {!isReady && !error && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/80 text-white/50">
          Loading 3D tiles...
        </div>
      )}

      {/* Night Tuner panel */}
      <NightTuner />

      {/* Editor toolbar */}
      <div className="fixed right-3 top-20 z-50 flex w-56 flex-col gap-2 rounded-xl border border-white/10 bg-black/85 p-3 text-white/90 shadow-2xl backdrop-blur-md">
        <div className="text-xs font-semibold uppercase tracking-wider text-white/60">
          Exclusion Zones
        </div>

        <button
          onClick={() => setAddMode(!addMode)}
          className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
            addMode
              ? "bg-red-500/80 text-white"
              : "bg-white/10 text-white/70 hover:bg-white/20"
          }`}
        >
          {addMode ? "Cancel Placing" : "Add Zone"}
        </button>

        {addMode && (
          <div className="text-[10px] text-white/40">
            Click on the map to place an exclusion zone. Click an existing zone
            to delete it.
          </div>
        )}

        <label className="flex flex-col gap-1">
          <div className="flex justify-between text-[10px]">
            <span className="text-white/60">Radius</span>
            <span className="font-mono text-white/40">{radius}m</span>
          </div>
          <input
            type="range"
            min={20}
            max={500}
            step={10}
            value={radius}
            onChange={(e) => setRadius(parseInt(e.target.value, 10))}
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-red-400"
          />
        </label>

        <div className="text-[10px] text-white/40">
          {zones.length}/{MAX_EXCLUSION_ZONES} zones
        </div>

        {zones.length > 0 && (
          <>
            <div className="flex flex-col gap-1">
              {zones.map((zone, i) => (
                <div
                  key={zone.id}
                  className="flex items-center justify-between rounded bg-white/5 px-2 py-1"
                >
                  <span className="text-[10px] text-white/50">
                    Zone {i + 1} ({zone.radius}m)
                  </span>
                  <button
                    onClick={() => removeZone(zone.id)}
                    className="text-[10px] text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={clearAll}
              className="rounded-lg bg-white/5 px-3 py-1.5 text-[10px] text-white/50 hover:bg-white/10 hover:text-white/70"
            >
              Clear All
            </button>
          </>
        )}
      </div>
    </div>
  );
}
