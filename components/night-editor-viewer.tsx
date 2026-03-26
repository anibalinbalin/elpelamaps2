"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BoundingSphere,
  CallbackProperty,
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  ColorMaterialProperty,
  ConstantPositionProperty,
  ConstantProperty,
  Entity,
  HeadingPitchRange,
  Math as CesiumMath,
  PolygonHierarchy,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Viewer,
  createGooglePhotorealistic3DTileset,
  defined,
  type Cesium3DTileset,
} from "cesium";
import { applyNightMode } from "@/lib/night-mode";
import { GOOGLE_MAPS_API_KEY, JOSE_IGNACIO_CENTER } from "@/lib/constants";
import type { NightZoneCollection } from "@/lib/night-zones";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    CESIUM_BASE_URL?: string;
  }
}

type EditorMode = "select" | "draw";

const ZONE_FILL = Color.fromCssColorString("rgba(255, 80, 60, 0.22)");
const ZONE_OUTLINE = Color.fromCssColorString("rgba(255, 120, 90, 0.85)");
const ZONE_SELECTED_FILL = Color.fromCssColorString("rgba(255, 60, 40, 0.35)");
const ZONE_SELECTED_OUTLINE = Color.fromCssColorString("#ff5a3a");
const DRAWING_FILL = Color.fromCssColorString("rgba(255, 100, 70, 0.18)");
const DRAWING_OUTLINE = Color.fromCssColorString("rgba(255, 140, 100, 0.7)");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function closeRing(ring: [number, number][]): [number, number][] {
  if (ring.length === 0) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  return [...ring, first];
}

function uniqueZoneId(existingIds: Set<string>): string {
  let index = existingIds.size + 1;
  let next = `zone-${index}`;
  while (existingIds.has(next)) {
    index += 1;
    next = `zone-${index}`;
  }
  return next;
}

function lonLatFromCartesian(cartesian: Cartesian3): [number, number] {
  const carto = Cartographic.fromCartesian(cartesian);
  return [
    CesiumMath.toDegrees(carto.longitude),
    CesiumMath.toDegrees(carto.latitude),
  ];
}

function zonesToCollection(
  zones: Map<string, { name: string; ring: [number, number][] }>,
): NightZoneCollection {
  return {
    type: "FeatureCollection",
    features: [...zones.entries()].map(([id, { name, ring }]) => ({
      type: "Feature" as const,
      properties: { id, name },
      geometry: { type: "Polygon" as const, coordinates: [closeRing(ring)] },
    })),
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NightEditorViewer() {
  const googleApiKey = GOOGLE_MAPS_API_KEY;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const tilesetRef = useRef<Cesium3DTileset | null>(null);
  const handlerRef = useRef<ScreenSpaceEventHandler | null>(null);
  const nightCleanupRef = useRef<(() => void) | null>(null);

  // Zone data: id → { name, ring (open, lon/lat) }
  const zonesRef = useRef(new Map<string, { name: string; ring: [number, number][] }>());
  // Zone entities: id → Entity
  const zoneEntitiesRef = useRef(new Map<string, Entity>());

  // Drawing state
  const drawingVerticesRef = useRef<Cartesian3[]>([]);
  const drawingEntityRef = useRef<Entity | null>(null);
  const editorModeRef = useRef<EditorMode>("select");

  // Vertex editing state
  const vertexEntitiesRef = useRef<Entity[]>([]);
  const draggingVertexRef = useRef<{ zoneId: string; index: number } | null>(null);

  const [zoneCount, setZoneCount] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>("select");
  const [, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [isSceneReady, setIsSceneReady] = useState(false);

  const selectedIdRef = useRef<string | null>(null);
  const saveStateRef = useRef<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  useEffect(() => { saveStateRef.current = saveState; }, [saveState]);
  useEffect(() => { editorModeRef.current = editorMode; }, [editorMode]);

  // -----------------------------------------------------------------------
  // Save zones to API
  // -----------------------------------------------------------------------

  const saveZones = useCallback(async (collection?: NightZoneCollection) => {
    const data = collection ?? zonesToCollection(zonesRef.current);
    if (saveStateRef.current === "saving") return;

    setSaveState("saving");
    setSaveMessage("");

    try {
      const response = await fetch("/api/night-zones", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Could not save exclusion zones.");
      setSaveState("saved");
      setSaveMessage("Zones saved.");
    } catch (err) {
      setSaveState("error");
      setSaveMessage(err instanceof Error ? err.message : "Save failed.");
    }
  }, []);

  // -----------------------------------------------------------------------
  // Zone entity management
  // -----------------------------------------------------------------------

  const addZoneEntity = useCallback((
    viewer: Viewer,
    id: string,
    ring: [number, number][],
    selected = false,
  ) => {
    const positions = ring.map(([lon, lat]) => Cartesian3.fromDegrees(lon, lat, 0));
    const entity = viewer.entities.add({
      id: `zone-${id}`,
      polygon: {
        hierarchy: new PolygonHierarchy(positions),
        material: new ColorMaterialProperty(selected ? ZONE_SELECTED_FILL : ZONE_FILL),
        outline: true,
        outlineColor: new ConstantProperty(selected ? ZONE_SELECTED_OUTLINE : ZONE_OUTLINE),
        outlineWidth: new ConstantProperty(selected ? 3 : 2),
        classificationType: undefined,
      },
    });
    zoneEntitiesRef.current.set(id, entity);
    return entity;
  }, []);

  const removeZoneEntity = useCallback((viewer: Viewer, id: string) => {
    const entity = zoneEntitiesRef.current.get(id);
    if (entity) {
      viewer.entities.remove(entity);
      zoneEntitiesRef.current.delete(id);
    }
  }, []);

  const highlightZone = useCallback((_viewer: Viewer, id: string | null) => {
    for (const [zid, entity] of zoneEntitiesRef.current) {
      const sel = zid === id;
      if (entity.polygon) {
        entity.polygon.material = new ColorMaterialProperty(sel ? ZONE_SELECTED_FILL : ZONE_FILL);
        entity.polygon.outlineColor = new ConstantProperty(sel ? ZONE_SELECTED_OUTLINE : ZONE_OUTLINE);
        entity.polygon.outlineWidth = new ConstantProperty(sel ? 3 : 2);
      }
    }
  }, []);

  // -----------------------------------------------------------------------
  // Vertex markers for editing
  // -----------------------------------------------------------------------

  const clearVertices = useCallback((viewer: Viewer) => {
    for (const entity of vertexEntitiesRef.current) {
      viewer.entities.remove(entity);
    }
    vertexEntitiesRef.current = [];
  }, []);

  const showVertices = useCallback((viewer: Viewer, zoneId: string) => {
    clearVertices(viewer);
    const zone = zonesRef.current.get(zoneId);
    if (!zone) return;

    for (let i = 0; i < zone.ring.length; i++) {
      const [lon, lat] = zone.ring[i];
      const entity = viewer.entities.add({
        id: `vertex-${zoneId}-${i}`,
        position: Cartesian3.fromDegrees(lon, lat, 1),
        point: {
          pixelSize: 14,
          color: Color.WHITE,
          outlineColor: Color.fromCssColorString("#ff5a3a"),
          outlineWidth: 3,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      vertexEntitiesRef.current.push(entity);
    }
  }, [clearVertices]);

  // -----------------------------------------------------------------------
  // Rebuild all zone entities from zonesRef
  // -----------------------------------------------------------------------

  const rebuildZoneEntities = useCallback((viewer: Viewer) => {
    // Remove all existing zone entities
    for (const id of zoneEntitiesRef.current.keys()) {
      removeZoneEntity(viewer, id);
    }
    // Recreate from zonesRef
    for (const [id, { ring }] of zonesRef.current) {
      addZoneEntity(viewer, id, ring, id === selectedIdRef.current);
    }
    setZoneCount(zonesRef.current.size);
  }, [addZoneEntity, removeZoneEntity]);

  // -----------------------------------------------------------------------
  // Load zones from API
  // -----------------------------------------------------------------------

  const loadZones = useCallback(async () => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/night-zones", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load zone data.");

      const collection: NightZoneCollection = await response.json();
      zonesRef.current.clear();

      for (const feature of collection.features) {
        const id = feature.properties.id;
        const name = feature.properties.name;
        const ring = feature.geometry.coordinates[0] as [number, number][];
        // Store open ring (remove closing point if present)
        const open = ring.length > 1 &&
          ring[0][0] === ring[ring.length - 1][0] &&
          ring[0][1] === ring[ring.length - 1][1]
          ? ring.slice(0, -1)
          : ring;
        zonesRef.current.set(id, { name, ring: open });
      }

      rebuildZoneEntities(viewer);
      setSaveState("idle");
      setSaveMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load zone data.");
    } finally {
      setLoading(false);
    }
  }, [rebuildZoneEntities]);

  // -----------------------------------------------------------------------
  // Editor mode switching
  // -----------------------------------------------------------------------

  const applyEditorMode = useCallback((mode: EditorMode) => {
    setEditorMode(mode);
    if (mode === "draw") {
      setSelectedId(null);
      highlightZone(viewerRef.current!, null);
      clearVertices(viewerRef.current!);
    }
    // Clean up any in-progress drawing when switching to select
    if (mode === "select") {
      const viewer = viewerRef.current;
      if (viewer && drawingEntityRef.current) {
        viewer.entities.remove(drawingEntityRef.current);
        drawingEntityRef.current = null;
      }
      drawingVerticesRef.current = [];
    }
  }, [highlightZone, clearVertices]);

  // -----------------------------------------------------------------------
  // Delete selected zone
  // -----------------------------------------------------------------------

  const deleteSelected = useCallback(() => {
    const viewer = viewerRef.current;
    const id = selectedIdRef.current;
    if (!viewer || !id) return;

    clearVertices(viewer);
    zonesRef.current.delete(id);
    removeZoneEntity(viewer, id);
    setSelectedId(null);
    setZoneCount(zonesRef.current.size);
    void saveZones(zonesToCollection(zonesRef.current));
  }, [removeZoneEntity, saveZones, clearVertices]);

  // -----------------------------------------------------------------------
  // Fit view to zones
  // -----------------------------------------------------------------------

  const fitToZones = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer || zonesRef.current.size === 0) return;

    const points: Cartesian3[] = [];
    for (const { ring } of zonesRef.current.values()) {
      for (const [lon, lat] of ring) {
        points.push(Cartesian3.fromDegrees(lon, lat, 0));
      }
    }

    if (points.length === 0) return;

    const sphere = BoundingSphere.fromPoints(points);
    viewer.camera.flyToBoundingSphere(sphere, {
      duration: 0.5,
      offset: new HeadingPitchRange(0, CesiumMath.toRadians(-90), sphere.radius * 3),
    });
  }, []);

  // -----------------------------------------------------------------------
  // Cesium viewer init
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!googleApiKey || !containerRef.current || viewerRef.current) return;

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

    // Setup scene
    viewer.scene.backgroundColor = Color.BLACK;
    viewer.scene.globe.baseColor = Color.TRANSPARENT;
    viewer.scene.globe.imageryLayers.removeAll();
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.show = false;
    }
    viewer.postProcessStages.fxaa.enabled = true;

    // Lock to top-down controls: pan only, no tilt/rotate
    const controller = viewer.scene.screenSpaceCameraController;
    controller.maximumZoomDistance = 6000;
    controller.minimumZoomDistance = 200;
    controller.enableTilt = false;
    controller.enableLook = false;

    // Disable default double-click (we use it for finishing polygons)
    viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
      ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
    );

    viewerRef.current = viewer;

    // Set initial top-down view
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(
        JOSE_IGNACIO_CENTER.lon,
        JOSE_IGNACIO_CENTER.lat,
        3000,
      ),
      orientation: {
        heading: 0,
        pitch: CesiumMath.toRadians(-90),
        roll: 0,
      },
    });

    // --- Click handler for drawing & selecting ---
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction((movement: { position: Cartesian2 }) => {
      if (editorModeRef.current === "draw") {
        // Add vertex to drawing
        const cartesian = viewer.scene.pickPosition(movement.position);
        if (!cartesian || !defined(cartesian) || isNaN(cartesian.x)) return;

        drawingVerticesRef.current.push(cartesian);

        // Create or update the drawing preview entity
        if (!drawingEntityRef.current) {
          const verticesRef = drawingVerticesRef;
          drawingEntityRef.current = viewer.entities.add({
            id: "__drawing__",
            polygon: {
              hierarchy: new CallbackProperty(() => {
                if (verticesRef.current.length < 2) return undefined;
                return new PolygonHierarchy(verticesRef.current);
              }, false) as unknown as PolygonHierarchy,
              material: new ColorMaterialProperty(DRAWING_FILL),
              outline: true,
              outlineColor: new ConstantProperty(DRAWING_OUTLINE),
              outlineWidth: new ConstantProperty(2),
            },
          });
        }
      } else {
        // Select mode: pick a zone entity
        const picked = viewer.scene.pick(movement.position);
        if (defined(picked) && picked.id instanceof Entity) {
          const entityId = picked.id.id;
          // Ignore clicks on vertex markers (handled by LEFT_DOWN)
          if (entityId?.startsWith("vertex-")) return;
          if (entityId?.startsWith("zone-")) {
            const zoneId = entityId.slice(5);
            selectedIdRef.current = zoneId;
            setSelectedId(zoneId);
            highlightZone(viewer, zoneId);
            showVertices(viewer, zoneId);
            return;
          }
        }
        // Clicked empty space — deselect, clear vertices, auto-save if had selection
        const hadSelection = selectedIdRef.current != null;
        if (hadSelection) {
          clearVertices(viewer);
          void saveZones(zonesToCollection(zonesRef.current));
        }
        selectedIdRef.current = null;
        setSelectedId(null);
        highlightZone(viewer, null);
      }
    }, ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction(() => {
      if (editorModeRef.current !== "draw") return;
      if (drawingVerticesRef.current.length < 3) return;

      // Finish polygon
      const ring: [number, number][] = drawingVerticesRef.current.map(lonLatFromCartesian);
      const existingIds = new Set(zonesRef.current.keys());
      const id = uniqueZoneId(existingIds);
      const name = `Zone ${zonesRef.current.size + 1}`;

      zonesRef.current.set(id, { name, ring });

      // Remove drawing entity
      if (drawingEntityRef.current) {
        viewer.entities.remove(drawingEntityRef.current);
        drawingEntityRef.current = null;
      }
      drawingVerticesRef.current = [];

      // Add permanent zone entity
      addZoneEntity(viewer, id, ring, true);
      setZoneCount(zonesRef.current.size);

      // Select the new zone and switch to select mode
      selectedIdRef.current = id;
      setSelectedId(id);
      setEditorMode("select");
      editorModeRef.current = "select";
      highlightZone(viewer, id);
      showVertices(viewer, id);

      // Save
      void saveZones(zonesToCollection(zonesRef.current));
    }, ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

    // Vertex drag: LEFT_DOWN — start dragging if a vertex is picked
    handler.setInputAction((movement: { position: Cartesian2 }) => {
      if (editorModeRef.current !== "select") return;
      const picked = viewer.scene.pick(movement.position);
      if (!defined(picked) || !(picked.id instanceof Entity)) return;
      const entityId = picked.id.id;
      if (!entityId?.startsWith("vertex-")) return;

      // Parse "vertex-{zoneId}-{index}"
      const parts = entityId.split("-");
      const index = parseInt(parts[parts.length - 1], 10);
      const zoneId = parts.slice(1, parts.length - 1).join("-");

      draggingVertexRef.current = { zoneId, index };
      viewer.scene.screenSpaceCameraController.enableInputs = false;
    }, ScreenSpaceEventType.LEFT_DOWN);

    // Vertex drag: LEFT_UP — finish dragging
    handler.setInputAction(() => {
      if (draggingVertexRef.current) {
        viewer.scene.screenSpaceCameraController.enableInputs = true;
        draggingVertexRef.current = null;
        void saveZones(zonesToCollection(zonesRef.current));
      }
    }, ScreenSpaceEventType.LEFT_UP);

    // Cursor feedback + vertex dragging
    handler.setInputAction((movement: { endPosition: Cartesian2 }) => {
      // Handle vertex dragging
      if (draggingVertexRef.current) {
        const { zoneId, index } = draggingVertexRef.current;
        const cartesian = viewer.scene.pickPosition(movement.endPosition);
        if (!cartesian || !defined(cartesian) || isNaN(cartesian.x)) return;

        const [lon, lat] = lonLatFromCartesian(cartesian);

        // Update zone data
        const zone = zonesRef.current.get(zoneId);
        if (!zone) return;
        zone.ring[index] = [lon, lat];

        // Update vertex entity position
        const vertexEntity = vertexEntitiesRef.current[index];
        if (vertexEntity) {
          vertexEntity.position = new ConstantPositionProperty(
            Cartesian3.fromDegrees(lon, lat, 1),
          );
        }

        // Update zone polygon entity hierarchy
        const zoneEntity = zoneEntitiesRef.current.get(zoneId);
        if (zoneEntity?.polygon) {
          const positions = zone.ring.map(([lo, la]) => Cartesian3.fromDegrees(lo, la, 0));
          zoneEntity.polygon.hierarchy = new ConstantProperty(
            new PolygonHierarchy(positions),
          );
        }

        (viewer.container as HTMLElement).style.cursor = "grabbing";
        return;
      }

      if (editorModeRef.current === "draw") {
        (viewer.container as HTMLElement).style.cursor = "crosshair";
        return;
      }
      const picked = viewer.scene.pick(movement.endPosition);
      if (defined(picked) && picked.id instanceof Entity) {
        const eid = picked.id.id;
        if (eid?.startsWith("vertex-")) {
          (viewer.container as HTMLElement).style.cursor = "grab";
          return;
        }
        if (eid?.startsWith("zone-")) {
          (viewer.container as HTMLElement).style.cursor = "pointer";
          return;
        }
      }
      (viewer.container as HTMLElement).style.cursor = "grab";
    }, ScreenSpaceEventType.MOUSE_MOVE);

    handlerRef.current = handler;

    // --- Load Google 3D Tiles + apply night shader ---
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

          // Apply night shader immediately
          nightCleanupRef.current = applyNightMode(viewer, tilesetRef);

          tileset.initialTilesLoaded.addEventListener(() => {
            if (!disposed) setIsSceneReady(true);
          });
          if (tileset.tilesLoaded) setIsSceneReady(true);
        } catch (loadError) {
          if (disposed) return;
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load Google Photorealistic 3D Tiles.",
          );
        }
      })();
    });

    // Load zones after viewer is ready
    void (async () => {
      // Small delay to ensure viewer is fully initialized
      await new Promise((r) => setTimeout(r, 100));
      if (!disposed) {
        setLoading(true);
        try {
          const response = await fetch("/api/night-zones", { cache: "no-store" });
          if (!response.ok) throw new Error("Could not load zone data.");
          const collection: NightZoneCollection = await response.json();
          zonesRef.current.clear();
          for (const feature of collection.features) {
            const id = feature.properties.id;
            const name = feature.properties.name;
            const ring = feature.geometry.coordinates[0] as [number, number][];
            const open = ring.length > 1 &&
              ring[0][0] === ring[ring.length - 1][0] &&
              ring[0][1] === ring[ring.length - 1][1]
              ? ring.slice(0, -1)
              : ring;
            zonesRef.current.set(id, { name, ring: open });
          }
          // Create entities for loaded zones
          for (const [id, { ring }] of zonesRef.current) {
            addZoneEntity(viewer, id, ring);
          }
          setZoneCount(zonesRef.current.size);
          setSaveState("idle");
          setSaveMessage("");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not load zone data.");
        } finally {
          setLoading(false);
        }
      }
    })();

    return () => {
      disposed = true;
      nightCleanupRef.current?.();
      nightCleanupRef.current = null;
      if (loadTilesetFrameId != null) window.cancelAnimationFrame(loadTilesetFrameId);
      handlerRef.current?.destroy();
      handlerRef.current = null;
      zoneEntitiesRef.current.clear();
      zonesRef.current.clear();
      drawingEntityRef.current = null;
      drawingVerticesRef.current = [];
      vertexEntitiesRef.current = [];
      draggingVertexRef.current = null;
      viewerRef.current?.destroy();
      viewerRef.current = null;
      tilesetRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleApiKey]);

  // -----------------------------------------------------------------------
  // UI
  // -----------------------------------------------------------------------

  const headerStatus =
    saveState === "saving"
      ? "Saving..."
      : saveState === "error"
        ? "Save failed"
        : saveState === "saved"
          ? "All saved"
          : "Ready";

  if (!googleApiKey) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a] text-sm text-white/50">
        Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#111417] text-white">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between bg-gradient-to-b from-[#0b1015]/74 via-[#0b1015]/28 to-transparent px-5 py-4">
        <div className="pointer-events-auto flex items-center gap-3 rounded-[26px] border border-white/10 bg-[rgba(19,24,30,0.88)] px-4 py-3 shadow-[0_18px_48px_rgba(3,10,16,0.34)] backdrop-blur-xl">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/44">
              Night Editor
            </div>
            <div className="mt-1 text-[15px] font-semibold tracking-[-0.02em] text-white">
              Exclusion Zone Workspace
            </div>
          </div>
          <div className="mx-1 h-9 w-px bg-white/10" />
          <a
            href="/viewer"
            className="rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-2 text-[13px] font-semibold text-white/78 transition-colors duration-200 hover:border-white/18 hover:bg-white/[0.08] hover:text-white"
          >
            3D Viewer
          </a>
        </div>

        <div className="pointer-events-auto flex items-center gap-2 rounded-[999px] border border-white/10 bg-[rgba(19,24,30,0.84)] px-3 py-2 text-[11px] text-white/72 shadow-[0_18px_48px_rgba(3,10,16,0.28)] backdrop-blur-xl">
          <span>{zoneCount} zone{zoneCount !== 1 ? "s" : ""}</span>
          <span className="h-1 w-1 rounded-full bg-white/20" />
          <span>{headerStatus}</span>
        </div>
      </div>

      {/* Toolbar — floating left */}
      <div className="pointer-events-auto absolute left-4 top-[88px] z-20 flex flex-col gap-2 rounded-[22px] border border-white/10 bg-[rgba(16,20,25,0.92)] p-3 shadow-[0_32px_90px_rgba(3,10,16,0.42)] backdrop-blur-xl">
        <button
          type="button"
          onClick={() => applyEditorMode("draw")}
          className={`rounded-[18px] px-4 py-2 text-[13px] font-semibold transition-colors duration-200 ${
            editorMode === "draw"
              ? "bg-[#b83a2a] text-white"
              : "border border-white/10 bg-white/[0.04] text-white/78 hover:border-white/16 hover:bg-white/[0.08] hover:text-white"
          }`}
        >
          New Zone
        </button>
        <button
          type="button"
          onClick={() => applyEditorMode("select")}
          className={`rounded-[18px] px-4 py-2 text-[13px] font-semibold transition-colors duration-200 ${
            editorMode === "select"
              ? "bg-white/[0.14] text-white"
              : "border border-white/10 bg-white/[0.04] text-white/78 hover:border-white/16 hover:bg-white/[0.08] hover:text-white"
          }`}
        >
          Select
        </button>
        <button
          type="button"
          onClick={deleteSelected}
          disabled={!selectedId}
          className={`rounded-[18px] px-4 py-2 text-[13px] font-semibold transition-colors duration-200 ${
            selectedId
              ? "border border-red-400/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
              : "border border-white/6 bg-white/[0.02] text-white/30 cursor-not-allowed"
          }`}
        >
          Delete
        </button>
        <div className="h-px bg-white/8" />
        <button
          type="button"
          onClick={fitToZones}
          className="rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-2 text-[13px] font-semibold text-white/78 transition-colors duration-200 hover:border-white/16 hover:bg-white/[0.08] hover:text-white"
        >
          Fit Zones
        </button>
        <button
          type="button"
          onClick={() => void loadZones()}
          className="rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-2 text-[13px] font-semibold text-white/78 transition-colors duration-200 hover:border-white/16 hover:bg-white/[0.08] hover:text-white"
        >
          Reset
        </button>
      </div>

      {/* Instructions hint */}
      {editorMode === "draw" && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-[18px] border border-white/10 bg-[rgba(16,20,25,0.88)] px-5 py-3 text-[12px] text-white/60 shadow-lg backdrop-blur-xl">
          Click to place vertices. Double-click to finish the zone.
        </div>
      )}

      {/* Status messages */}
      {saveMessage && saveState === "error" && (
        <div className="pointer-events-none absolute bottom-16 left-4 z-20 max-w-[420px] rounded-[18px] border border-amber-400/30 bg-amber-400/[0.08] px-4 py-3 text-[12px] text-amber-200 shadow-lg backdrop-blur-md">
          {saveMessage}
        </div>
      )}
      {error && (
        <div className="pointer-events-none absolute bottom-4 left-4 z-20 max-w-[420px] rounded-[18px] border border-red-400/30 bg-red-400/[0.08] px-4 py-3 text-[12px] text-red-200 shadow-lg backdrop-blur-md">
          {error}
        </div>
      )}

      {!isSceneReady && !error && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/60 text-white/50">
          Loading night scene...
        </div>
      )}
    </div>
  );
}
