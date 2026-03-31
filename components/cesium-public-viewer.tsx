"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  BoundingSphere,
  CameraEventType,
  Cartesian2,
  Cartesian3,
  ClassificationType,
  Color,
  ColorMaterialProperty,
  ConstantProperty,
  HeadingPitchRange,
  JulianDate,
  KeyboardEventModifier,
  Matrix3,
  Matrix4,
  Math as CesiumMath,
  PostProcessStage,
  PostProcessStageSampleMode,
  PolygonHierarchy,
  SceneTransforms,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Transforms,
  Viewer,
  createGooglePhotorealistic3DTileset,
  defined,
  type Cesium3DTileset,
  type Entity,
} from "cesium";
import { applyNightMode, recreateNightShader, getMaskPixels, MASK_BOUNDS_LON_LAT, MASK_SIZE, NIGHT_SHADER } from "@/lib/night-mode";
import { SunArcDrawer } from "@/components/sun-arc-drawer";
import { timeToSunAngles } from "@/lib/sun-position";
import { rasterizeZonesToCanvas } from "@/lib/night-zones";
import type { NightZoneCollection } from "@/lib/night-zones";
import { Compass01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { GOOGLE_MAPS_API_KEY, JOSE_IGNACIO_CENTER, PARCEL_COLORS, CESIUM_CAMERA_BEHAVIOR } from "@/lib/constants";
import { useParcelData } from "@/lib/use-parcel-data";
import { centroid, formatAreaCompact } from "@/lib/geo-utils";
import { useParcelSelection } from "@/lib/use-parcel-selection";
import { usePillPositions } from "@/lib/use-pill-positions";
import { ParcelPillsOverlay, type PillPosition } from "./parcel-pills";
import { ParcelSidebar } from "./parcel-sidebar";
import { TopBar } from "./top-bar";
import { ViewerLoadingSkeleton } from "./viewer-loading-skeleton";

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

const DEG2RAD = Math.PI / 180;

// Reference: January 15 summer day in José Ignacio (UY = UTC-3).
// t=0 → 6:00 AM local = 09:00 UTC. t=1 → midnight local = 03:00 UTC next day.
const SUN_ARC_REFERENCE_UTC = JulianDate.fromDate(new Date("2025-01-15T09:00:00Z"));
const JOSE_IGNACIO_CENTER_CARTESIAN = Cartesian3.fromDegrees(
  JOSE_IGNACIO_CENTER.lon,
  JOSE_IGNACIO_CENTER.lat,
  0,
);
const JOSE_IGNACIO_ENU_ROTATION = Matrix4.getMatrix3(
  Transforms.eastNorthUpToFixedFrame(JOSE_IGNACIO_CENTER_CARTESIAN),
  new Matrix3(),
);
const SUN_DIRECTION_SCRATCH = new Cartesian3();
const SUN_DIRECTION_WORLD = new Cartesian3();
const SHADOW_STEP_COUNT = 14;
const SUN_SHADOW_STAGE_FRAGMENT = /* glsl */ `
  uniform sampler2D colorTexture;
  uniform sampler2D depthTexture;
  in vec2 v_textureCoordinates;
  uniform vec3 u_shadowDirectionWC;
  uniform float u_shadowStrength;
  uniform float u_shadowMetersPerStep;
  uniform float u_shadowDepthBias;
  uniform float u_shadowSoftness;

  vec3 worldPositionFromUv(vec2 uv, float depth)
  {
    vec4 positionEC = czm_windowToEyeCoordinates(uv * czm_viewport.zw, depth);
    positionEC /= positionEC.w;
    vec4 positionWC = czm_inverseView * vec4(positionEC.xyz, 1.0);
    return positionWC.xyz / positionWC.w;
  }

  vec3 eyePositionFromUv(vec2 uv, float depth)
  {
    vec4 positionEC = czm_windowToEyeCoordinates(uv * czm_viewport.zw, depth);
    return positionEC.xyz / positionEC.w;
  }

  vec2 worldToUv(vec3 positionWC)
  {
    vec4 clip = czm_viewProjection * vec4(positionWC, 1.0);
    if (clip.w <= 0.0) {
      return vec2(-1.0);
    }

    vec2 uv = clip.xy / clip.w * 0.5 + 0.5;
    return uv;
  }

  void main()
  {
    vec4 color = texture(colorTexture, v_textureCoordinates);
    if (u_shadowStrength <= 0.001) {
      out_FragColor = color;
      return;
    }

    float receiverDepth = czm_readDepth(depthTexture, v_textureCoordinates);
    if (receiverDepth == 0.0) {
      out_FragColor = color;
      return;
    }

    float luminance = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
    float blueRatio = color.b / (luminance + 0.001);
    float maxC = max(color.r, max(color.g, color.b));
    float minC = min(color.r, min(color.g, color.b));
    float saturation = (maxC > 0.001) ? (maxC - minC) / maxC : 0.0;
    float water = smoothstep(1.35, 1.95, blueRatio) * smoothstep(0.06, 0.18, saturation);

    vec3 receiverWC = worldPositionFromUv(v_textureCoordinates, receiverDepth);
    float shadow = 0.0;

    for (int i = 1; i <= ${SHADOW_STEP_COUNT}; i++) {
      float stepMeters = float(i) * u_shadowMetersPerStep;
      vec3 sampleWC = receiverWC + u_shadowDirectionWC * stepMeters;
      vec2 sampleUv = worldToUv(sampleWC);

      if (sampleUv.x <= 0.001 || sampleUv.y <= 0.001 || sampleUv.x >= 0.999 || sampleUv.y >= 0.999) {
        break;
      }

      float sceneDepth = czm_readDepth(depthTexture, sampleUv);
      if (sceneDepth == 0.0) {
        continue;
      }

      vec3 sceneWC = worldPositionFromUv(sampleUv, sceneDepth);
      vec3 sceneEC = eyePositionFromUv(sampleUv, sceneDepth);
      vec4 sampleEC4 = czm_view * vec4(sampleWC, 1.0);
      vec3 sampleEC = sampleEC4.xyz / sampleEC4.w;
      float depthDelta = sceneEC.z - sampleEC.z;
      float hit = smoothstep(u_shadowDepthBias, u_shadowDepthBias + u_shadowSoftness, depthDelta);
      vec3 rayDelta = sceneWC - receiverWC;
      float alongRay = dot(rayDelta, u_shadowDirectionWC);
      vec3 closestPointOnRay = receiverWC + u_shadowDirectionWC * alongRay;
      float rayMiss = distance(sceneWC, closestPointOnRay);
      float rayMatch = 1.0 - smoothstep(10.0, 32.0, rayMiss);
      hit *= rayMatch * (stepMeters <= alongRay ? 1.0 : 0.0);
      float distanceFade = 1.0 - (float(i - 1) / float(${SHADOW_STEP_COUNT}));
      shadow = max(shadow, hit * distanceFade);
    }

    shadow *= u_shadowStrength;
    shadow *= (1.0 - water);

    float darken = shadow * 0.34;
    out_FragColor = vec4(color.rgb * (1.0 - darken), color.a);
  }
`;

function arcTToJulianDate(t: number): JulianDate {
  return JulianDate.addSeconds(
    SUN_ARC_REFERENCE_UTC,
    Math.max(0, Math.min(1, t)) * 18 * 3600,
    new JulianDate(),
  );
}

function sunAnglesToWorldDirection(
  azimuthDeg: number,
  elevationDeg: number,
  result = new Cartesian3(),
): Cartesian3 {
  const azimuth = azimuthDeg * DEG2RAD;
  const elevation = elevationDeg * DEG2RAD;
  Cartesian3.fromElements(
    Math.sin(azimuth) * Math.cos(elevation),
    Math.cos(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
    SUN_DIRECTION_SCRATCH,
  );
  Matrix3.multiplyByVector(JOSE_IGNACIO_ENU_ROTATION, SUN_DIRECTION_SCRATCH, result);
  return Cartesian3.normalize(result, result);
}

// Subtle vignette only — CesiumJS SkyAtmosphere handles the real sky/horizon
const VIGNETTE_STYLE = {
  background: [
    "radial-gradient(circle at 50% 44%, rgba(255, 255, 255, 0) 50%, rgba(17, 24, 31, 0.03) 82%, rgba(13, 18, 24, 0.06) 100%)",
  ].join(", "),
} as CSSProperties;

const INITIAL_CAMERA_OFFSET = new HeadingPitchRange(
  CesiumMath.toRadians(0),
  CesiumMath.toRadians(-48),
  2150,
);

const SELECTED_CAMERA_PITCH = CesiumMath.toRadians(-52);

function VignetteOverlay() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1]"
      style={VIGNETTE_STYLE}
    />
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

function ViewerControlsHint() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-20 flex justify-center px-4">
      <div className="max-w-[min(100%,36rem)] rounded-[18px] border border-white/10 bg-[rgba(16,20,25,0.82)] px-5 py-3 text-center text-[12px] text-white/60 shadow-lg backdrop-blur-xl">
        <span className="sm:hidden">
          Drag to orbit. Use two fingers to zoom and tilt the view.
        </span>
        <span className="hidden sm:inline">
          Drag to orbit. Scroll to zoom. Hold
          <span className="px-1 font-mono text-white/82">Shift</span>
          while dragging to tilt the view.
        </span>
      </div>
    </div>
  );
}

/** Map camera altitude to a target pitch via the auto-tilt curve. */
function computeAutoTiltPitch(altitude: number): number {
  const { highAltitude, lowAltitude, highPitchDeg, lowPitchDeg } =
    CESIUM_CAMERA_BEHAVIOR.autoTilt;
  const t = CesiumMath.clamp(
    (altitude - lowAltitude) / (highAltitude - lowAltitude),
    0,
    1,
  );
  return CesiumMath.toRadians(lowPitchDeg + (highPitchDeg - lowPitchDeg) * t);
}

function CompassButton({
  viewerRef,
}: {
  viewerRef: React.RefObject<Viewer | null>;
}) {
  const [headingDeg, setHeadingDeg] = useState(0);
  const lastHeadingRef = useRef(0);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const removeListener = viewer.scene.postRender.addEventListener(() => {
      const deg = CesiumMath.toDegrees(viewer.camera.heading);
      // Only update state when heading changes noticeably (avoid re-renders)
      if (Math.abs(deg - lastHeadingRef.current) > 0.5) {
        lastHeadingRef.current = deg;
        setHeadingDeg(deg);
      }
    });

    return () => removeListener();
  }, [viewerRef]);

  const handleClick = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    viewer.camera.flyTo({
      destination: viewer.camera.position,
      orientation: {
        heading: 0,
        pitch: viewer.camera.pitch,
        roll: 0,
      },
      duration: CESIUM_CAMERA_BEHAVIOR.northResetDuration,
    });
  };

  // Hide when already facing north (within 2°)
  const isNorth = Math.abs(headingDeg) < 2 || Math.abs(headingDeg - 360) < 2;

  return (
    <button
      onClick={handleClick}
      className={`fixed bottom-6 right-6 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-[rgba(20,26,32,0.72)] shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-md transition-opacity duration-300 hover:border-white/25 hover:bg-[rgba(28,34,42,0.82)] ${
        isNorth ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      title="Reset to north"
    >
      <div
        style={{ transform: `rotate(${-headingDeg}deg)` }}
        className="transition-transform duration-100"
      >
        <HugeiconsIcon icon={Compass01Icon} size={18} className="text-white/80" />
      </div>
    </button>
  );
}

/**
 * Set up Google Earth-style wheel zoom, right-drag zoom, and auto-tilt.
 * Returns a cleanup function.
 */
function setupGoogleEarthNavigation(
  viewer: Viewer,
  isFlyingRef: React.RefObject<boolean>,
) {
  const {
    sensitivity,
    damping,
    minVelocity,
    gestureTimeoutMs,
    rightDragSensitivity,
    dragStartThresholdPx,
  } = CESIUM_CAMERA_BEHAVIOR.zoomToCursor;
  const controller = viewer.scene.screenSpaceCameraController;
  const canvas = viewer.scene.canvas;

  // Remove wheel and right-drag from Cesium's built-in zoom so we handle them ourselves.
  controller.zoomEventTypes = [CameraEventType.PINCH];

  let zoomVelocity = 0;
  let pickPoint: Cartesian3 | null = null;
  let isZooming = false;
  let zoomTimeout: number | null = null;
  let isRightDragging = false;
  let rightDragMoved = false;
  let rightDragClientX = 0;
  let rightDragClientY = 0;
  let lastRightClickAt = 0;
  let lastRightClickClientX = 0;
  let lastRightClickClientY = 0;

  function setZoomGestureActive() {
    isZooming = true;
    if (zoomTimeout != null) window.clearTimeout(zoomTimeout);
    zoomTimeout = window.setTimeout(() => {
      isZooming = false;
      zoomTimeout = null;
      if (!isRightDragging) {
        pickPoint = null;
      }
    }, gestureTimeoutMs);
  }

  function getCameraAltitude(): number {
    const carto = viewer.camera.positionCartographic;
    const groundHeight = viewer.scene.globe.getHeight(carto) ?? 0;
    return Math.max(carto.height - groundHeight, 1);
  }

  function toCanvasPosition(clientX: number, clientY: number): Cartesian2 {
    const rect = canvas.getBoundingClientRect();
    return new Cartesian2(clientX - rect.left, clientY - rect.top);
  }

  function pickWorldPosition(clientX: number, clientY: number): Cartesian3 | null {
    const windowPos = toCanvasPosition(clientX, clientY);
    // Try 3D tiles first
    const picked = viewer.scene.pickPosition(windowPos);
    if (defined(picked) && !isNaN(picked.x)) return picked;
    // Fallback: ellipsoid
    const ellipsoidPick = viewer.camera.pickEllipsoid(windowPos, viewer.scene.globe.ellipsoid);
    return ellipsoidPick ?? null;
  }

  function queueZoom(velocityDelta: number, clientX: number, clientY: number) {
    if (!pickPoint) {
      pickPoint = pickWorldPosition(clientX, clientY);
    }
    if (!pickPoint) return;

    zoomVelocity += velocityDelta;
    setZoomGestureActive();
  }

  function zoomByRatio(clientX: number, clientY: number, ratio: number) {
    const pickedPosition = pickWorldPosition(clientX, clientY);
    if (!pickedPosition) return;

    const currentDistance = Cartesian3.distance(
      viewer.camera.positionWC,
      pickedPosition,
    );
    const targetDistance = CesiumMath.clamp(
      currentDistance * ratio,
      controller.minimumZoomDistance,
      controller.maximumZoomDistance,
    );

    isFlyingRef.current = true;
    viewer.camera.flyToBoundingSphere(new BoundingSphere(pickedPosition, 0), {
      duration: CESIUM_CAMERA_BEHAVIOR.doubleClickDuration,
      offset: new HeadingPitchRange(
        viewer.camera.heading,
        computeAutoTiltPitch(targetDistance),
        targetDistance,
      ),
      complete: () => { isFlyingRef.current = false; },
      cancel: () => { isFlyingRef.current = false; },
    });
  }

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    if (isFlyingRef.current) return;

    // Wheel-up should zoom in, matching Google Earth.
    queueZoom(-event.deltaY * sensitivity, event.clientX, event.clientY);
  };

  const onMouseDown = (event: MouseEvent) => {
    if (event.button !== 2 || isFlyingRef.current) return;

    event.preventDefault();
    isRightDragging = true;
    rightDragMoved = false;
    rightDragClientX = event.clientX;
    rightDragClientY = event.clientY;
    pickPoint = pickWorldPosition(event.clientX, event.clientY);
    canvas.style.cursor = "grabbing";
  };

  const onMouseMove = (event: MouseEvent) => {
    if (!isRightDragging || isFlyingRef.current) return;

    const deltaX = event.clientX - rightDragClientX;
    const deltaY = event.clientY - rightDragClientY;
    if (
      !rightDragMoved &&
      Math.hypot(deltaX, deltaY) >= dragStartThresholdPx
    ) {
      rightDragMoved = true;
    }

    if (deltaY !== 0) {
      queueZoom(-deltaY * rightDragSensitivity, event.clientX, event.clientY);
    }

    rightDragClientX = event.clientX;
    rightDragClientY = event.clientY;
    event.preventDefault();
  };

  const onMouseUp = (event: MouseEvent) => {
    if (event.button !== 2 || !isRightDragging) return;

    event.preventDefault();
    isRightDragging = false;
    canvas.style.cursor = "grab";

    if (rightDragMoved) {
      zoomVelocity = 0;
      isZooming = false;
      pickPoint = null;
      return;
    }

    const now = Date.now();
    const clickDistance = Math.hypot(
      event.clientX - lastRightClickClientX,
      event.clientY - lastRightClickClientY,
    );
    const isDoubleClick =
      now - lastRightClickAt <= CESIUM_CAMERA_BEHAVIOR.rightDoubleClickThresholdMs &&
      clickDistance <= 14;

    lastRightClickAt = now;
    lastRightClickClientX = event.clientX;
    lastRightClickClientY = event.clientY;

    if (!isDoubleClick) {
      return;
    }

    lastRightClickAt = 0;
    zoomByRatio(
      event.clientX,
      event.clientY,
      1 / CESIUM_CAMERA_BEHAVIOR.doubleClickZoomRatio,
    );
  };

  const onContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };

  // Per-frame animation: apply zoom velocity and auto-tilt
  const removePreRender = viewer.scene.preRender.addEventListener(() => {
    if (isFlyingRef.current) {
      zoomVelocity = 0;
      pickPoint = null;
      return;
    }

    // Apply zoom velocity
    if (Math.abs(zoomVelocity) > minVelocity && pickPoint) {
      const camera = viewer.camera;
      const currentDistance = Cartesian3.distance(camera.positionWC, pickPoint);

      // Scale movement relative to distance (closer = smaller steps)
      const moveAmount = zoomVelocity * currentDistance;
      const direction = new Cartesian3();
      Cartesian3.subtract(pickPoint, camera.positionWC, direction);
      Cartesian3.normalize(direction, direction);

      // Compute new position
      const newPos = new Cartesian3();
      Cartesian3.multiplyByScalar(direction, moveAmount, newPos);
      Cartesian3.add(camera.positionWC, newPos, newPos);

      // Check distance constraints
      const newDistance = Cartesian3.distance(newPos, pickPoint);
      if (
        newDistance >= controller.minimumZoomDistance &&
        newDistance <= controller.maximumZoomDistance
      ) {
        camera.position = newPos;
      } else if (newDistance < controller.minimumZoomDistance) {
        // Clamp to min distance
        const clampDir = new Cartesian3();
        Cartesian3.subtract(camera.positionWC, pickPoint, clampDir);
        Cartesian3.normalize(clampDir, clampDir);
        Cartesian3.multiplyByScalar(clampDir, controller.minimumZoomDistance, clampDir);
        Cartesian3.add(pickPoint, clampDir, newPos);
        camera.position = newPos;
        zoomVelocity = 0;
      } else {
        zoomVelocity = 0;
      }

      // Decay velocity (inertia)
      zoomVelocity *= damping;
    } else {
      zoomVelocity = 0;
      pickPoint = null;
    }

    // Auto-tilt: blend pitch toward altitude-based target during zoom
    if (isZooming || Math.abs(zoomVelocity) > minVelocity) {
      const altitude = getCameraAltitude();
      const targetPitch = computeAutoTiltPitch(altitude);
      const currentPitch = viewer.camera.pitch;
      const newPitch = currentPitch + (targetPitch - currentPitch) * 0.08;

      if (Math.abs(newPitch - currentPitch) > 0.001) {
        viewer.camera.setView({
          orientation: {
            heading: viewer.camera.heading,
            pitch: newPitch,
            roll: 0,
          },
        });
      }
    }
  });

  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("mousedown", onMouseDown);
  canvas.addEventListener("contextmenu", onContextMenu);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);

  return () => {
    canvas.removeEventListener("wheel", onWheel);
    canvas.removeEventListener("mousedown", onMouseDown);
    canvas.removeEventListener("contextmenu", onContextMenu);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    removePreRender();
    if (zoomTimeout != null) window.clearTimeout(zoomTimeout);
  };
}

export function CesiumPublicViewer() {
  const googleApiKey = GOOGLE_MAPS_API_KEY;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const tilesetRef = useRef<Cesium3DTileset | null>(null);
  const handlerRef = useRef<ScreenSpaceEventHandler | null>(null);
  const removePostRenderRef = useRef<(() => void) | null>(null);
  const parcelBundlesRef = useRef(new Map<string, ParcelEntityBundle>());
  const hasFramedInitialViewRef = useRef(false);
  const lastAnimatedParcelIdRef = useRef<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const isFlyingRef = useRef(false);
  const cleanupZoomRef = useRef<(() => void) | null>(null);
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
  const [isSceneReady, setIsSceneReady] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [error, setError] = useState("");
  const cloudSwooshTimeoutRef = useRef<number | null>(null);
  const hasMarkedSceneReadyRef = useRef(false);
  const [manualNightMode, setManualNightMode] = useState(false);
  const [sunArcNight, setSunArcNight] = useState(false);
  const isNightMode = manualNightMode || sunArcNight;
  const [isSunMode, setIsSunMode] = useState(false);
  const [sunT, setSunT] = useState(0.5); // default: afternoon
  const sunTRef = useRef(0.5);
  const nightCleanupRef = useRef<(() => void) | null>(null);
  const sunShadowStageRef = useRef<PostProcessStage | null>(null);
  const sunShadowDirectionRef = useRef(Cartesian3.clone(Cartesian3.UNIT_Z));
  const sunShadowStrengthRef = useRef(0);
  const sunShadowStepMetersRef = useRef(16);
  const sunShadowDepthBiasRef = useRef(3.5);
  const sunShadowSoftnessRef = useRef(14);
  const prevIsSunModeRef = useRef(false);

  useEffect(() => {
    sunTRef.current = sunT;
  }, [sunT]);

  const syncSunShaderUniforms = useCallback((t: number, shader = NIGHT_SHADER) => {
    const state = timeToSunAngles(t);
    const daylight = 1 - state.blend;
    const elevationFactor = CesiumMath.clamp(state.elevation / 75, 0, 1);

    sunAnglesToWorldDirection(state.azimuth, state.elevation, SUN_DIRECTION_WORLD);
    Cartesian3.clone(SUN_DIRECTION_WORLD, sunShadowDirectionRef.current);
    sunShadowStrengthRef.current = daylight * CesiumMath.lerp(0.56, 0.2, elevationFactor);
    const shadowDistance = CesiumMath.lerp(180, 72, elevationFactor);
    sunShadowStepMetersRef.current = shadowDistance / SHADOW_STEP_COUNT;
    sunShadowDepthBiasRef.current = CesiumMath.lerp(4.5, 2.4, elevationFactor);
    sunShadowSoftnessRef.current = CesiumMath.lerp(16, 8, elevationFactor);

    try {
      shader.setUniform("u_sunAzimuth", state.azimuth * DEG2RAD);
      shader.setUniform("u_sunElevation", state.elevation * DEG2RAD);
      shader.setUniform("u_timeOfDay", state.blend);
      shader.setUniform("u_tintR", state.colorTemp.r);
      shader.setUniform("u_tintG", state.colorTemp.g);
      shader.setUniform("u_tintB", state.colorTemp.b);
    } catch {
      // Shader may not be compiled yet — uniforms will take effect after first compile
    }

    return state;
  }, []);

  const handleSunTime = useCallback(
    (t: number) => {
      setSunT(t);
      const { isNight } = syncSunShaderUniforms(t);

      // Cesium clock still drives the sky/atmosphere even though the tiles
      // rely on the custom shader for facade response.
      const viewer = viewerRef.current;
      if (viewer) {
        viewer.clock.currentTime = arcTToJulianDate(t);
      }

      // Guard: only toggle if the value actually changes to avoid triggering
      // the shader attach effect on every drag frame.
      setSunArcNight((prev) => (prev === isNight ? prev : isNight));
    },
    [syncSunShaderUniforms],
  );

  const parcelsBoundingSphereRef = useRef<BoundingSphere | null>(null);
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
    parcelsBoundingSphereRef.current = parcelsBoundingSphere;
  }, [parcelsBoundingSphere]);

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
    if (!googleApiKey || !containerRef.current || viewerRef.current) {
      if (!googleApiKey) {
        setError("Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local");
      }
      return;
    }

    setError("");
    setIsSceneReady(false);
    hasMarkedSceneReadyRef.current = false;
    window.CESIUM_BASE_URL = "/Cesium/";
    let disposed = false;
    let loadTilesetFrameId: number | null = null;
    let removeInitialTilesLoadedListener: (() => void) | null = null;

    const markSceneReady = () => {
      if (disposed || hasMarkedSceneReadyRef.current) {
        return;
      }

      hasMarkedSceneReadyRef.current = true;
      removeInitialTilesLoadedListener?.();
      removeInitialTilesLoadedListener = null;
      window.requestAnimationFrame(() => {
        if (!disposed) {
          setIsSceneReady(true);
        }
      });
    };

    const viewer = new Viewer(containerRef.current, {
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      // Globe kept for atmosphere rendering — surface hidden below
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

    // Google Earth-style atmosphere: keep globe for sky rendering, hide surface
    viewer.scene.backgroundColor = Color.BLACK;
    viewer.scene.globe.baseColor = Color.TRANSPARENT;
    viewer.scene.globe.showGroundAtmosphere = true;
    viewer.scene.globe.atmosphereLightIntensity = 10.0;
    viewer.scene.globe.imageryLayers.removeAll();
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.show = true;
    }
    viewer.postProcessStages.fxaa.enabled = true;
    sunShadowStageRef.current = viewer.scene.postProcessStages.add(new PostProcessStage({
      name: "sun-shadow-projection",
      fragmentShader: SUN_SHADOW_STAGE_FRAGMENT,
      sampleMode: PostProcessStageSampleMode.LINEAR,
      uniforms: {
        u_shadowDirectionWC: () => sunShadowDirectionRef.current,
        u_shadowStrength: () => sunShadowStrengthRef.current,
        u_shadowMetersPerStep: () => sunShadowStepMetersRef.current,
        u_shadowDepthBias: () => sunShadowDepthBiasRef.current,
        u_shadowSoftness: () => sunShadowSoftnessRef.current,
      },
    })) as PostProcessStage;
    sunShadowStageRef.current.enabled = false;
    (viewer.container as HTMLElement).style.touchAction = "none";
    viewer.scene.canvas.style.touchAction = "none";
    const controller = viewer.scene.screenSpaceCameraController;
    controller.maximumZoomDistance = 4000;
    controller.minimumZoomDistance = 220;
    controller.enableCollisionDetection = true;
    controller.inertiaSpin = 0.75;
    controller.inertiaTranslate = 0.82;
    controller.inertiaZoom = 0.7;

    // Google Earth-style controls:
    // Left drag = move/orbit (spin3D contextual — default rotateEventTypes)
    // Right drag = custom zoom with auto-tilt
    // Shift+left drag = tilt
    // Pinch remains enabled so touch devices can tilt/rotate without a keyboard.
    // Ctrl+left drag = free-look
    controller.tiltEventTypes = [
      CameraEventType.MIDDLE_DRAG,
      CameraEventType.PINCH,
      { eventType: CameraEventType.LEFT_DRAG, modifier: KeyboardEventModifier.SHIFT },
    ];
    // Zoom via PINCH only — wheel/right-drag zoom is handled by setupGoogleEarthNavigation
    controller.zoomEventTypes = [CameraEventType.PINCH];
    // rotateEventTypes stays as LEFT_DRAG (default) — spin3D handles pan contextually
    // Ctrl+drag = freelook (turn head without moving), like Google Earth 3D
    controller.lookEventTypes = [
      { eventType: CameraEventType.LEFT_DRAG, modifier: KeyboardEventModifier.CTRL },
    ];
    viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
      ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
    );

    viewerRef.current = viewer;

    // Google Earth-style wheel/right-drag zoom + auto-tilt
    cleanupZoomRef.current = setupGoogleEarthNavigation(viewer, isFlyingRef);

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

    // Double-click to zoom in (Google Earth-style)
    handler.setInputAction((movement: { position: Cartesian2 }) => {
      // Skip if a parcel was clicked — parcel selection already handles fly-to
      const parcelId = getPickedParcelId(
        viewer.scene.pick(movement.position),
        parcelBundlesRef.current,
      );
      if (parcelId) return;

      const pickedPosition = viewer.scene.pickPosition(movement.position);
      if (!defined(pickedPosition) || isNaN(pickedPosition.x)) return;

      const currentDistance = Cartesian3.distance(
        viewer.camera.positionWC,
        pickedPosition,
      );
      const targetDistance = CesiumMath.clamp(
        currentDistance * CESIUM_CAMERA_BEHAVIOR.doubleClickZoomRatio,
        viewer.scene.screenSpaceCameraController.minimumZoomDistance,
        viewer.scene.screenSpaceCameraController.maximumZoomDistance,
      );
      const targetPitch = computeAutoTiltPitch(targetDistance);

      isFlyingRef.current = true;
      viewer.camera.flyToBoundingSphere(
        new BoundingSphere(pickedPosition, 0),
        {
          duration: CESIUM_CAMERA_BEHAVIOR.doubleClickDuration,
          offset: new HeadingPitchRange(
            viewer.camera.heading,
            targetPitch,
            targetDistance,
          ),
          complete: () => { isFlyingRef.current = false; },
          cancel: () => { isFlyingRef.current = false; },
        },
      );
    }, ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

    handlerRef.current = handler;

    // Defer the tileset fetch so the first Strict Mode cleanup can cancel it.
    loadTilesetFrameId = window.requestAnimationFrame(() => {
      void (async () => {
        try {
          const tileset = await createGooglePhotorealistic3DTileset({
            key: googleApiKey,
            onlyUsingWithGoogleGeocoder: true,
          });
          if (disposed) {
            return;
          }
          tilesetRef.current = tileset;
          viewer.scene.primitives.add(tileset);

          removeInitialTilesLoadedListener = tileset.initialTilesLoaded.addEventListener(
            markSceneReady,
          );

          if (parcelsBoundingSphereRef.current) {
            viewer.camera.flyToBoundingSphere(parcelsBoundingSphereRef.current, {
              duration: 0,
              offset: INITIAL_CAMERA_OFFSET,
            });
            hasFramedInitialViewRef.current = true;
          }
          if (tileset.tilesLoaded) {
            markSceneReady();
          }
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
    });

    return () => {
      nightCleanupRef.current?.();
      nightCleanupRef.current = null;
      if (sunShadowStageRef.current && viewer.scene.postProcessStages.contains(sunShadowStageRef.current)) {
        viewer.scene.postProcessStages.remove(sunShadowStageRef.current);
      }
      sunShadowStageRef.current = null;
      disposed = true;
      if (loadTilesetFrameId != null) {
        window.cancelAnimationFrame(loadTilesetFrameId);
      }
      removeInitialTilesLoadedListener?.();
      hoverParcel(null);
      selectParcel(null);
      updatePillPositions([], null);
      removePostRenderRef.current?.();
      removePostRenderRef.current = null;
      cleanupZoomRef.current?.();
      cleanupZoomRef.current = null;
      handlerRef.current?.destroy();
      handlerRef.current = null;
      viewerRef.current?.destroy();
      viewerRef.current = null;
      tilesetRef.current = null;
      parcelBundlesRef.current.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- parcelsBoundingSphere accessed via ref to avoid viewer recreation
  }, [googleApiKey, hoverParcel, selectParcel, updatePillPositions]);

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

    if (!hasFramedInitialViewRef.current && parcelBundlesRef.current.size > 0 && parcelsBoundingSphereRef.current) {
      viewer.camera.flyToBoundingSphere(parcelsBoundingSphereRef.current, {
        duration: 0,
        offset: INITIAL_CAMERA_OFFSET,
      });
      hasFramedInitialViewRef.current = true;
    }
  }, [parcels, updatePillPositions]);

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

    isFlyingRef.current = true;
    viewer.camera.flyToBoundingSphere(bundle.sphere, {
      duration: 1.4,
      offset: new HeadingPitchRange(
        viewer.camera.heading,
        SELECTED_CAMERA_PITCH,
        range,
      ),
      complete: () => { isFlyingRef.current = false; },
      cancel: () => { isFlyingRef.current = false; },
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

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    // Clean up the previous shader application before re-attaching it.
    nightCleanupRef.current?.();
    nightCleanupRef.current = null;

    if (isSunMode || isNightMode) {
      // Fetch exclusion zones, bake them into a fresh shader, then apply.
      // Creating a new CustomShader with the mask texture already set avoids
      // relying on setUniform for SAMPLER_2D after compilation (which Cesium
      // may silently ignore on an already-compiled shader).
      let cancelled = false;
      void (async () => {
        let maskPixels: Uint8Array | undefined;
        try {
          const res = await fetch("/api/night-zones", { cache: "no-store" });
          if (!cancelled && res.ok) {
            const zones: NightZoneCollection = await res.json();
            if (!cancelled && zones.features.length > 0) {
              const canvas = document.createElement("canvas");
              canvas.width = MASK_SIZE;
              canvas.height = MASK_SIZE;
              rasterizeZonesToCanvas(canvas, zones, MASK_BOUNDS_LON_LAT);
              maskPixels = getMaskPixels(canvas) ?? undefined;
            }
          }
        } catch {
          // Non-critical — night mode still works without mask zones
        }

        if (cancelled) return;
        const shader = recreateNightShader(maskPixels);
        if (isSunMode) {
          syncSunShaderUniforms(sunTRef.current, shader);
        }
        nightCleanupRef.current = applyNightMode(viewer, tilesetRef, shader);
      })();

      return () => {
        cancelled = true;
        nightCleanupRef.current?.();
        nightCleanupRef.current = null;
      };
    }
  }, [isNightMode, isSunMode, syncSunShaderUniforms]);

  useEffect(() => {
    if (prevIsSunModeRef.current && !isSunMode) {
      // Restore default night shader uniforms when sun mode is dismissed
      try {
        NIGHT_SHADER.setUniform("u_sunAzimuth",   0.0);
        NIGHT_SHADER.setUniform("u_sunElevation", 1.309);
        NIGHT_SHADER.setUniform("u_timeOfDay",    1.0);
        NIGHT_SHADER.setUniform("u_tintR",        0.040);
        NIGHT_SHADER.setUniform("u_tintG",        0.110);
        NIGHT_SHADER.setUniform("u_tintB",        0.680);
      } catch {
        // Shader not yet compiled — no-op
      }

      // Restore Cesium clock to present; tile shading is handled by the
      // custom shader and does not use Cesium's shadow pipeline here.
      const viewer = viewerRef.current;
      if (viewer) {
        viewer.clock.currentTime = JulianDate.now();
      }
      const shadowStage = sunShadowStageRef.current;
      if (shadowStage) {
        shadowStage.enabled = false;
      }
      sunShadowStrengthRef.current = 0;

      // Reset sun arc night state so manual 🌙 toggle is unaffected
      setSunArcNight(false);
    }

    if (!prevIsSunModeRef.current && isSunMode) {
      // Sync shader to current arc position when drawer is first opened
      handleSunTime(sunT);
    }
    prevIsSunModeRef.current = isSunMode;
  }, [isSunMode, sunT, handleSunTime]);

  useEffect(() => {
    const shadowStage = sunShadowStageRef.current;
    if (!shadowStage) return;
    shadowStage.enabled = isSunMode;
    if (!isSunMode) {
      sunShadowStrengthRef.current = 0;
    }
  }, [isSunMode]);

  // Dim overlay — fades in as sun approaches the horizon (elevation 20° → 0°)
  // Only active in sun mode during daytime; night shader handles darkness at night
  const sunDimOpacity = useMemo(() => {
    if (!isSunMode || isNightMode) return 0;
    const { elevation } = timeToSunAngles(sunT);
    const clamped = Math.max(0, Math.min(20, elevation));
    return (1 - clamped / 20) * 0.45;
  }, [isSunMode, isNightMode, sunT]);

  if (!googleApiKey) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a] text-sm text-white/50">
        Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#111820]">
      <div
        className={`absolute inset-0 transition-opacity duration-500 ${
          isSceneReady ? "opacity-100" : "opacity-0"
        }`}
      >
        <div ref={containerRef} className="absolute inset-0 touch-none" />
        {!isNightMode && <VignetteOverlay />}
        {!isNightMode && <CloudVeilOverlay active={isCloudSwooshing} cleared={cloudsCleared} />}
        {sunDimOpacity > 0 && (
          <div
            className="pointer-events-none absolute inset-0 bg-black"
            style={{ opacity: sunDimOpacity }}
          />
        )}
        {isSunMode && (
          <SunArcDrawer sunT={sunT} onSunT={handleSunTime} />
        )}
      </div>
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${
          isSceneReady ? "opacity-100" : "opacity-0"
        }`}
      >
        <TopBar
          drawMode={false}
          parcelCount={parcels.features.length}
          cloudSwooshTick={cloudSwooshTick}
          cloudsCleared={cloudsCleared}
          isCloudSwooshing={isCloudSwooshing}
          onSwooshClouds={handleCloudSwoosh}
          isNightMode={isNightMode}
          onToggleNightMode={() => setManualNightMode((v) => !v)}
          isSunMode={isSunMode}
          onToggleSunMode={() => setIsSunMode((v) => !v)}
        />
        <ParcelPillsOverlay positions={pillPositions} />
        <ParcelSidebar />
        <ViewerControlsHint />
        <CompassButton viewerRef={viewerRef} />
      </div>
      {(showSkeleton || !isSceneReady) && !error ? (
        <div
          className={`transition-opacity duration-700 ${
            isSceneReady ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
          onTransitionEnd={() => {
            if (isSceneReady) setShowSkeleton(false);
          }}
        >
          <ViewerLoadingSkeleton overlay />
        </div>
      ) : null}
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
