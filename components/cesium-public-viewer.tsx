"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  ClassificationType,
  Color,
  ColorMaterialProperty,
  ConstantProperty,
  HeadingPitchRange,
  Ion,
  Math as CesiumMath,
  PolygonHierarchy,
  SceneTransforms,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Viewer,
  createGooglePhotorealistic3DTileset,
  defined,
  type Cesium3DTileset,
  type Entity,
} from "cesium";
import { JOSE_IGNACIO_CENTER, PARCEL_COLORS } from "@/lib/constants";
import { useParcelData } from "@/lib/use-parcel-data";
import { centroid, formatAreaCompact } from "@/lib/geo-utils";
import { useParcelSelection } from "@/lib/use-parcel-selection";
import { usePillPositions } from "@/lib/use-pill-positions";
import { ParcelPillsOverlay, type PillPosition } from "./parcel-pills";
import { ParcelSidebar } from "./parcel-sidebar";
import { TopBar } from "./top-bar";

declare global {
  interface Window {
    CESIUM_BASE_URL?: string;
  }
}

interface ParcelEntityBundle {
  id: string;
  centroid: [number, number];
  labelAnchor: Cartesian3;
  properties: {
    id: string;
    name: string;
    areaSqMeters: number;
    priceUSD?: number;
    zoning?: string;
    status?: "for-sale" | "sold" | "reserved";
    description?: string;
    contactUrl?: string;
    color?: string;
  };
  polygon: Entity;
  outline: Entity;
  sphere: BoundingSphere;
}

const ATMOSPHERIC_WASH = {
  sky: {
    background: [
      "radial-gradient(ellipse at 50% -18%, rgba(255, 244, 215, 0.17), rgba(255, 244, 215, 0.06) 24%, rgba(255, 244, 215, 0) 56%)",
      "linear-gradient(180deg, rgba(88, 145, 212, 0.18) 0%, rgba(126, 182, 226, 0.12) 18%, rgba(161, 206, 234, 0.06) 34%, rgba(192, 219, 233, 0.02) 52%, rgba(192, 219, 233, 0) 66%)",
      "linear-gradient(180deg, rgba(255, 235, 194, 0) 48%, rgba(255, 235, 194, 0.07) 70%, rgba(255, 235, 194, 0.12) 82%, rgba(255, 235, 194, 0.06) 92%, rgba(255, 235, 194, 0) 100%)",
    ].join(", "),
  } as CSSProperties,
  horizon: {
    inset: "42% -9% 12% -9%",
    background: [
      "linear-gradient(180deg, rgba(174, 214, 245, 0) 0%, rgba(174, 214, 245, 0.1) 22%, rgba(201, 227, 244, 0.18) 40%, rgba(229, 214, 184, 0.18) 58%, rgba(229, 214, 184, 0.07) 72%, rgba(229, 214, 184, 0) 100%)",
      "radial-gradient(ellipse at 50% 58%, rgba(238, 223, 191, 0.24), rgba(238, 223, 191, 0.11) 36%, rgba(238, 223, 191, 0) 72%)",
    ].join(", "),
    filter: "blur(38px)",
    opacity: 0.88,
    transform: "scale(1.04)",
  } as CSSProperties,
  vignette: {
    background: [
      "linear-gradient(180deg, rgba(255, 252, 246, 0.045) 0%, rgba(255, 252, 246, 0.015) 16%, rgba(255, 252, 246, 0) 34%, rgba(17, 24, 31, 0.012) 100%)",
      "radial-gradient(circle at 50% 44%, rgba(255, 255, 255, 0) 50%, rgba(17, 24, 31, 0.02) 82%, rgba(13, 18, 24, 0.052) 100%)",
    ].join(", "),
  } as CSSProperties,
} as const;

const INITIAL_CAMERA_OFFSET = new HeadingPitchRange(
  CesiumMath.toRadians(0),
  CesiumMath.toRadians(-48),
  2150,
);

const SELECTED_CAMERA_PITCH = CesiumMath.toRadians(-52);

function AtmosphericWashOverlay() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={ATMOSPHERIC_WASH.sky}
      />
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={ATMOSPHERIC_WASH.horizon}
      />
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={ATMOSPHERIC_WASH.vignette}
      />
    </>
  );
}

function CloudVeilOverlay({
  active,
  cleared,
}: {
  active: boolean;
  cleared: boolean;
}) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 z-[2] transition-opacity duration-700 ${
        cleared ? "opacity-0" : active ? "opacity-35" : "opacity-100"
      }`}
    >
      <div className="absolute inset-x-[-12%] top-[6%] h-[18%] bg-[radial-gradient(ellipse_at_50%_50%,rgba(255,255,255,0.42),rgba(255,255,255,0.22)_34%,rgba(255,255,255,0)_72%)] blur-[30px]" />
      <div className="absolute right-[-8%] top-[16%] h-[22%] w-[36%] bg-[radial-gradient(ellipse_at_50%_50%,rgba(255,255,255,0.26),rgba(255,255,255,0.12)_38%,rgba(255,255,255,0)_74%)] blur-[34px]" />
      <div className="absolute left-[-6%] top-[14%] h-[20%] w-[42%] bg-[radial-gradient(ellipse_at_50%_50%,rgba(255,255,255,0.24),rgba(255,255,255,0.1)_36%,rgba(255,255,255,0)_74%)] blur-[36px]" />
    </div>
  );
}

export function CesiumPublicViewer() {
  const apiToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const tilesetRef = useRef<Cesium3DTileset | null>(null);
  const handlerRef = useRef<ScreenSpaceEventHandler | null>(null);
  const removePostRenderRef = useRef<(() => void) | null>(null);
  const parcelBundlesRef = useRef(new Map<string, ParcelEntityBundle>());
  const hasFramedInitialViewRef = useRef(false);
  const lastAnimatedParcelIdRef = useRef<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const parcels = useParcelData();
  const hoveredId = useParcelSelection((s) => s.hoveredId);
  const selectedId = useParcelSelection((s) => s.selectedId);
  const selectParcel = useParcelSelection((s) => s.select);
  const hoverParcel = useParcelSelection((s) => s.hover);
  const updatePillPositions = usePillPositions((s) => s.update);
  const pillPositions = usePillPositions((s) => s.positions);
  const [cloudSwooshTick, setCloudSwooshTick] = useState(0);
  const [cloudsCleared, setCloudsCleared] = useState(false);
  const [isCloudSwooshing, setIsCloudSwooshing] = useState(false);
  const [error, setError] = useState("");
  const cloudSwooshTimeoutRef = useRef<number | null>(null);
  const parcelsBoundingSphere = useMemo(() => {
    const cartesianPoints: Cartesian3[] = [];
    for (const feature of parcels.features) {
      const ring = getOpenRing(feature.geometry.coordinates[0] as [number, number][]);
      for (const [lon, lat] of ring) {
        cartesianPoints.push(Cartesian3.fromDegrees(lon, lat, 0));
      }
    }

    if (cartesianPoints.length === 0) {
      return BoundingSphere.fromPoints([
        Cartesian3.fromDegrees(JOSE_IGNACIO_CENTER.lon, JOSE_IGNACIO_CENTER.lat, 0),
      ]);
    }

    return BoundingSphere.fromPoints(cartesianPoints);
  }, [parcels]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    return () => {
      if (cloudSwooshTimeoutRef.current != null) {
        window.clearTimeout(cloudSwooshTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!apiToken || !containerRef.current || viewerRef.current) {
      if (!apiToken) {
        setError("Set NEXT_PUBLIC_CESIUM_ION_TOKEN in .env.local");
      }
      return;
    }

    setError("");
    window.CESIUM_BASE_URL = "/Cesium/";
    Ion.defaultAccessToken = apiToken;
    let disposed = false;

    const viewer = new Viewer(containerRef.current, {
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      globe: false,
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

    viewer.scene.backgroundColor = Color.fromCssColorString("#76879a");
    viewer.postProcessStages.fxaa.enabled = true;
    viewer.scene.screenSpaceCameraController.maximumZoomDistance = 4000;
    viewer.scene.screenSpaceCameraController.minimumZoomDistance = 220;
    viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;
    viewer.scene.screenSpaceCameraController.inertiaSpin = 0.75;
    viewer.scene.screenSpaceCameraController.inertiaTranslate = 0.82;
    viewer.scene.screenSpaceCameraController.inertiaZoom = 0.7;
    viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
      ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
    );

    viewerRef.current = viewer;

    const updateOverlayPositionsFromScene = () => {
      updateOverlayPositions(
        viewer,
        parcelBundlesRef.current,
        selectedIdRef.current,
        updatePillPositions,
      );
    };

    removePostRenderRef.current = viewer.scene.postRender.addEventListener(
      updateOverlayPositionsFromScene,
    );

    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((movement: { position: Cartesian2 }) => {
      const parcelId = getPickedParcelId(
        viewer.scene.pick(movement.position),
        parcelBundlesRef.current,
      );

      if (!parcelId) {
        selectParcel(null);
        return;
      }

      const bundle = parcelBundlesRef.current.get(parcelId);
      if (!bundle) {
        selectParcel(null);
        return;
      }

      selectParcel(bundle.properties);
    }, ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction((movement: { endPosition: Cartesian2 }) => {
      const parcelId = getPickedParcelId(
        viewer.scene.pick(movement.endPosition),
        parcelBundlesRef.current,
      );
      hoverParcel(parcelId);
      (viewer.container as HTMLElement).style.cursor = parcelId ? "pointer" : "grab";
    }, ScreenSpaceEventType.MOUSE_MOVE);

    handlerRef.current = handler;

    void (async () => {
      try {
        const tileset = await createGooglePhotorealistic3DTileset({
          onlyUsingWithGoogleGeocoder: true,
        });
        if (disposed) {
          return;
        }
        tilesetRef.current = tileset;
        viewer.scene.primitives.add(tileset);
        viewer.camera.flyToBoundingSphere(parcelsBoundingSphere, {
          duration: 0,
          offset: INITIAL_CAMERA_OFFSET,
        });
        hasFramedInitialViewRef.current = true;
      } catch (loadError) {
        if (disposed) {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load Google Photorealistic 3D Tiles in Cesium.",
        );
      }
    })();

    return () => {
      disposed = true;
      hoverParcel(null);
      selectParcel(null);
      updatePillPositions([], null);
      removePostRenderRef.current?.();
      removePostRenderRef.current = null;
      handlerRef.current?.destroy();
      handlerRef.current = null;
      viewerRef.current?.destroy();
      viewerRef.current = null;
      tilesetRef.current = null;
      parcelBundlesRef.current.clear();
    };
  }, [apiToken, hoverParcel, parcelsBoundingSphere, selectParcel, updatePillPositions]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) {
      return;
    }

    viewer.entities.removeAll();
    parcelBundlesRef.current.clear();

    for (const feature of parcels.features) {
      const ring = getOpenRing(feature.geometry.coordinates[0] as [number, number][]);
      if (ring.length < 3) {
        continue;
      }

      const [lon, lat] = centroid(ring);
      const polygonPositions = Cartesian3.fromDegreesArray(
        ring.flatMap(([ringLon, ringLat]) => [ringLon, ringLat]),
      );
      const outlinePositions = [...polygonPositions, polygonPositions[0]];
      const labelAnchor = Cartesian3.fromDegrees(lon, lat, 34);
      const sphere = BoundingSphere.fromPoints(polygonPositions);

      const polygon = viewer.entities.add({
        id: feature.properties.id,
        polygon: {
          hierarchy: new PolygonHierarchy(polygonPositions),
          material: cssColorToCesiumMaterial(PARCEL_COLORS.fill),
          classificationType: ClassificationType.CESIUM_3D_TILE,
          zIndex: constantNumber(2),
        },
      });

      const outline = viewer.entities.add({
        id: `${feature.properties.id}__outline`,
        polyline: {
          positions: outlinePositions,
          clampToGround: true,
          classificationType: ClassificationType.CESIUM_3D_TILE,
          material: cssColorToCesiumMaterial(PARCEL_COLORS.stroke),
          width: constantNumber(PARCEL_COLORS.strokeWidth),
          zIndex: constantNumber(3),
        },
      });

      parcelBundlesRef.current.set(feature.properties.id, {
        id: feature.properties.id,
        centroid: [lon, lat],
        labelAnchor,
        properties: feature.properties,
        polygon,
        outline,
        sphere,
      });
    }

    applyParcelStyles(parcelBundlesRef.current, hoveredId, selectedId);
    updateOverlayPositions(
      viewer,
      parcelBundlesRef.current,
      selectedId,
      updatePillPositions,
    );

    if (!hasFramedInitialViewRef.current && parcelBundlesRef.current.size > 0) {
      viewer.camera.flyToBoundingSphere(parcelsBoundingSphere, {
        duration: 0,
        offset: INITIAL_CAMERA_OFFSET,
      });
      hasFramedInitialViewRef.current = true;
    }
  }, [parcels, parcelsBoundingSphere, updatePillPositions]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) {
      return;
    }

    applyParcelStyles(parcelBundlesRef.current, hoveredId, selectedId);
    updateOverlayPositions(
      viewer,
      parcelBundlesRef.current,
      selectedId,
      updatePillPositions,
    );
    viewer.scene.requestRender();
  }, [hoveredId, selectedId, updatePillPositions]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !selectedId) {
      lastAnimatedParcelIdRef.current = null;
      return;
    }

    if (lastAnimatedParcelIdRef.current === selectedId) {
      return;
    }

    const bundle = parcelBundlesRef.current.get(selectedId);
    if (!bundle) {
      return;
    }

    const area = Math.max(bundle.properties.areaSqMeters, 1);
    const range = Math.max(520, Math.min(1350, Math.sqrt(area) * 12.5));

    viewer.camera.flyToBoundingSphere(bundle.sphere, {
      duration: 1.4,
      offset: new HeadingPitchRange(
        viewer.camera.heading,
        SELECTED_CAMERA_PITCH,
        range,
      ),
    });

    lastAnimatedParcelIdRef.current = selectedId;
  }, [selectedId]);

  function handleCloudSwoosh() {
    if (cloudsCleared) {
      return;
    }

    setCloudsCleared(true);
    setCloudSwooshTick((value) => value + 1);
    setIsCloudSwooshing(true);

    if (cloudSwooshTimeoutRef.current != null) {
      window.clearTimeout(cloudSwooshTimeoutRef.current);
    }

    cloudSwooshTimeoutRef.current = window.setTimeout(() => {
      setIsCloudSwooshing(false);
      cloudSwooshTimeoutRef.current = null;
    }, 1100);
  }

  if (!apiToken) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a] text-sm text-white/50">
        Set NEXT_PUBLIC_CESIUM_ION_TOKEN in .env.local
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#111820]">
      <div ref={containerRef} className="absolute inset-0" />
      <AtmosphericWashOverlay />
      <CloudVeilOverlay active={isCloudSwooshing} cleared={cloudsCleared} />
      <TopBar
        drawMode={false}
        parcelCount={parcels.features.length}
        cloudSwooshTick={cloudSwooshTick}
        cloudsCleared={cloudsCleared}
        isCloudSwooshing={isCloudSwooshing}
        onSwooshClouds={handleCloudSwoosh}
      />
      <ParcelPillsOverlay positions={pillPositions} />
      <ParcelSidebar />
      {error ? (
        <div className="pointer-events-none absolute bottom-4 left-4 z-20 max-w-[520px] rounded-[18px] border border-amber-300/30 bg-[rgba(32,25,16,0.86)] px-4 py-3 text-[13px] text-amber-100 shadow-[0_18px_50px_rgba(4,16,28,0.22)] backdrop-blur-md">
          {error}
        </div>
      ) : null}
    </div>
  );
}

function applyParcelStyles(
  bundles: Map<string, ParcelEntityBundle>,
  hoveredId: string | null,
  selectedId: string | null,
) {
  for (const bundle of bundles.values()) {
    const isSelected = bundle.id === selectedId;
    const isHovered = bundle.id === hoveredId;
    const fill = isSelected
      ? PARCEL_COLORS.fillSelected
      : isHovered
        ? PARCEL_COLORS.fillHover
        : PARCEL_COLORS.fill;
    const stroke = isSelected
      ? PARCEL_COLORS.strokeSelected
      : isHovered
        ? PARCEL_COLORS.strokeHover
        : PARCEL_COLORS.stroke;
    const strokeWidth = isSelected
      ? PARCEL_COLORS.strokeWidthSelected
      : PARCEL_COLORS.strokeWidth;

    if (bundle.polygon.polygon) {
      bundle.polygon.polygon.material = cssColorToCesiumMaterial(fill);
      bundle.polygon.polygon.zIndex = constantNumber(isSelected ? 5 : 2);
    }

    if (bundle.outline.polyline) {
      bundle.outline.polyline.material = cssColorToCesiumMaterial(stroke);
      bundle.outline.polyline.width = constantNumber(strokeWidth);
      bundle.outline.polyline.zIndex = constantNumber(isSelected ? 6 : 3);
    }
  }
}

function updateOverlayPositions(
  viewer: Viewer,
  bundles: Map<string, ParcelEntityBundle>,
  selectedId: string | null,
  update: (positions: PillPosition[], selectedPos: { x: number; y: number } | null) => void,
) {
  const positions: PillPosition[] = [];
  let selectedPos: { x: number; y: number } | null = null;
  const windowPosition = new Cartesian2();

  for (const bundle of bundles.values()) {
    const projected = SceneTransforms.worldToWindowCoordinates(
      viewer.scene,
      bundle.labelAnchor,
      windowPosition,
    );

    const visible =
      defined(projected) &&
      projected.x > -50 &&
      projected.x < viewer.canvas.clientWidth + 50 &&
      projected.y > -50 &&
      projected.y < viewer.canvas.clientHeight + 50;

    const { kicker, value } = splitParcelLabel(bundle.id);
    const position = {
      id: bundle.id,
      kicker,
      value,
      meta: formatAreaCompact(bundle.properties.areaSqMeters),
      x: Math.round(projected?.x ?? 0),
      y: Math.round(projected?.y ?? 0),
      visible,
    } satisfies PillPosition;

    positions.push(position);

    if (bundle.id === selectedId) {
      selectedPos = { x: position.x, y: position.y };
    }
  }

  update(positions, selectedPos);
}

function getPickedParcelId(
  picked: unknown,
  bundles: Map<string, ParcelEntityBundle>,
): string | null {
  if (!picked || typeof picked !== "object") {
    return null;
  }

  const candidate =
    (picked as { id?: unknown }).id ??
    (picked as { primitive?: { id?: unknown } }).primitive?.id;

  if (typeof candidate === "string" && bundles.has(candidate)) {
    return candidate;
  }

  if (
    candidate &&
    typeof candidate === "object" &&
    "id" in candidate &&
    typeof (candidate as { id?: unknown }).id === "string"
  ) {
    const entityId = (candidate as { id: string }).id;
    if (bundles.has(entityId)) {
      return entityId;
    }
  }

  return null;
}

function cssColorToCesiumColor(value: string) {
  return Color.fromCssColorString(value) ?? Color.WHITE;
}

function cssColorToCesiumMaterial(value: string) {
  return new ColorMaterialProperty(cssColorToCesiumColor(value));
}

function constantNumber(value: number) {
  return new ConstantProperty(value);
}

function getOpenRing(ring: [number, number][]) {
  if (ring.length === 0) {
    return [];
  }

  const [firstLon, firstLat] = ring[0];
  const [lastLon, lastLat] = ring[ring.length - 1];
  if (firstLon === lastLon && firstLat === lastLat) {
    return ring.slice(0, -1);
  }

  return ring;
}

function splitParcelLabel(id: string) {
  const label = id
    .replace(/[_-]+/g, " ")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  const parts = label.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return { kicker: parts[0], value: parts.slice(1).join(" ") };
  }
  return { kicker: "PARCEL", value: label };
}
