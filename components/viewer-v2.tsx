"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import type { RefObject } from "react";
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  Matrix4,
  MeshBasicMaterial,
  Vector3,
} from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { EffectComposer, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { toCreasedNormals } from "three/addons/utils/BufferGeometryUtils.js";
import type { TilesRenderer as TilesRendererImpl } from "3d-tiles-renderer/three";
// @ts-expect-error — present at runtime in 3d-tiles-renderer@0.4.24, barrel missing type
import { CAMERA_FRAME } from "3d-tiles-renderer";

import {
  TilesRenderer,
  TilesPlugin,
  GlobeControls,
} from "3d-tiles-renderer/r3f";
import { GoogleCloudAuthPlugin } from "3d-tiles-renderer/core/plugins";
import {
  GLTFExtensionsPlugin,
  TilesFadePlugin,
  UpdateOnChangePlugin,
} from "3d-tiles-renderer/three/plugins";

import { Atmosphere, AerialPerspective } from "@takram/three-atmosphere/r3f";
import { Clouds } from "@takram/three-clouds/r3f";
import { Dithering, LensFlare } from "@takram/three-geospatial-effects/r3f";

import { GOOGLE_MAPS_API_KEY } from "@/lib/constants";
import type { ParcelCollection, ParcelFeature } from "@/lib/parcels";
import { formatAreaCompact, formatPrice } from "@/lib/geo-utils";
import { Panel, Badge } from "@/components/ui";

const DEG2RAD = Math.PI / 180;
const ANIM_DURATION = 1.4;

function computeParcelTargetPose(feature: ParcelFeature): CameraPose {
  const ring = feature.geometry.coordinates[0];
  const n = ring.length - 1;
  let cLat = 0,
    cLon = 0;
  for (let i = 0; i < n; i++) {
    cLon += ring[i][0];
    cLat += ring[i][1];
  }
  cLon /= n;
  cLat /= n;

  const cosLat = Math.cos(cLat * DEG2RAD);
  let maxDistSq = 0;
  for (let i = 0; i < n; i++) {
    const dLon = (ring[i][0] - cLon) * cosLat * 111320;
    const dLat = (ring[i][1] - cLat) * 111320;
    const d2 = dLon * dLon + dLat * dLat;
    if (d2 > maxDistSq) maxDistSq = d2;
  }
  const boundingRadius = Math.sqrt(maxDistSq);
  const halfFovRad = 30 * DEG2RAD;
  const alt = Math.max(150, (boundingRadius / Math.tan(halfFovRad)) * 1.6);

  return { lat: cLat, lon: cLon, alt, headingDeg: 0, pitchDeg: -78 };
}

function lerpAngleDeg(from: number, to: number, t: number): number {
  const delta = ((to - from + 540) % 360) - 180;
  return from + t * delta;
}

function easeOutQuint(t: number): number {
  return 1 - (1 - t) ** 5;
}

const REFERENCE_YEAR = 2024;
const REFERENCE_MONTH = 2;
const REFERENCE_DAY = 1;

const URUGUAY_UTC_OFFSET_HOURS = -3;

const DEFAULTS = {
  coverage: 0.19,
  windSpeed: 0.0005,
  exposure: 10,
  cameraLat: -34.832685,
  cameraLon: -54.633519,
  cameraAltM: 1694,
  cameraHeadingDeg: 7,
  cameraPitchDeg: -66.3,
  hourLocal: 18,
  shadowFarScale: 0.25,
  shadowSplitLambda: 0.71,
  shadowMapSize: 512,
};

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("https://www.gstatic.com/draco/v1/decoders/");
dracoLoader.setDecoderConfig({ type: "js" });

class TileCreasedNormalsPlugin {
  processTileModel(scene: { traverse: (cb: (mesh: unknown) => void) => void }) {
    scene.traverse((node) => {
      const mesh = node as { geometry?: unknown };
      if (mesh.geometry) {
        mesh.geometry = toCreasedNormals(
          mesh.geometry as Parameters<typeof toCreasedNormals>[0],
          30 * DEG2RAD,
        );
      }
    });
  }
}

interface CameraPose {
  lat: number;
  lon: number;
  alt: number;
  headingDeg: number;
  pitchDeg: number;
}

function AnimatedCamera({
  tilesRef,
  initialPose,
  targetPose,
  exposure,
}: {
  tilesRef: RefObject<TilesRendererImpl | null>;
  initialPose: CameraPose;
  targetPose: CameraPose | null;
  exposure: number;
}) {
  const { camera, gl, controls, invalidate } = useThree();
  const fromPose = useRef<CameraPose>(initialPose);
  const currentPose = useRef<CameraPose>(initialPose);
  const animProgress = useRef(1);
  const prevTarget = useRef<CameraPose | null>(null);
  const tilesReady = useRef(false);
  const mat = useRef(new Matrix4());

  useEffect(() => {
    gl.toneMappingExposure = exposure;
  }, [gl, exposure]);

  const applyPose = useCallback(
    (pose: CameraPose): boolean => {
      const tiles = tilesRef.current;
      if (!tiles?.ellipsoid) return false;
      tiles.ellipsoid.getObjectFrame(
        pose.lat * DEG2RAD,
        pose.lon * DEG2RAD,
        pose.alt,
        pose.headingDeg * DEG2RAD,
        pose.pitchDeg * DEG2RAD,
        0,
        mat.current,
        CAMERA_FRAME,
      );
      camera.matrix.copy(mat.current);
      camera.matrix.decompose(camera.position, camera.quaternion, camera.scale);
      camera.updateMatrixWorld(true);
      return true;
    },
    [camera, tilesRef],
  );

  useEffect(() => {
    if (applyPose(initialPose)) {
      tilesReady.current = true;
      return;
    }
    const interval = setInterval(() => {
      if (applyPose(initialPose)) {
        tilesReady.current = true;
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [initialPose, applyPose]);

  useEffect(() => {
    if (targetPose === null) {
      prevTarget.current = null;
      return;
    }
    if (prevTarget.current === targetPose) return;
    prevTarget.current = targetPose;
    fromPose.current = { ...currentPose.current };
    animProgress.current = 0;
    if (controls) (controls as any).enabled = false;
  }, [targetPose, controls]);

  useFrame((_, delta) => {
    if (!tilesReady.current || animProgress.current >= 1) return;

    animProgress.current = Math.min(1, animProgress.current + delta / ANIM_DURATION);
    const t = easeOutQuint(animProgress.current);
    const from = fromPose.current;
    const to = prevTarget.current!;

    const pose: CameraPose = {
      lat: from.lat + (to.lat - from.lat) * t,
      lon: from.lon + (to.lon - from.lon) * t,
      alt: from.alt + (to.alt - from.alt) * t,
      headingDeg: lerpAngleDeg(from.headingDeg, to.headingDeg, t),
      pitchDeg: from.pitchDeg + (to.pitchDeg - from.pitchDeg) * t,
    };

    currentPose.current = pose;
    applyPose(pose);
    invalidate();

    if (animProgress.current >= 1 && controls) {
      (controls as any).enabled = true;
    }
  });

  return null;
}

function hourUTCToTimestamp(hourUTC: number) {
  return (
    Date.UTC(REFERENCE_YEAR, REFERENCE_MONTH, REFERENCE_DAY) + hourUTC * 3600000
  );
}

interface ParcelRender {
  feature: ParcelFeature;
  line: Line;
  fill: MeshBasicMaterial;
  meshGeom: BufferGeometry;
  centroid: Vector3;
}

interface StatusPalette {
  line: number;
  lineAlpha: number;
  fill: number;
  fillAlpha: number;
  lineSelected: number;
  fillSelected: number;
}

// For-sale: warm white (inviting). Reserved: amber (pending).
// Sold: muted slate (taken). Selected state layers gold over for-sale;
// reserved/sold keep their hue but brighten to signal focus.
const STATUS_PALETTE: Record<string, StatusPalette> = {
  "for-sale": {
    line: 0x34d399, lineAlpha: 1,
    fill: 0x10b981, fillAlpha: 0.12,
    lineSelected: 0x6ee7b7, fillSelected: 0x34d399,
  },
  reserved: {
    line: 0xfbbf24, lineAlpha: 1,
    fill: 0xfbbf24, fillAlpha: 0.14,
    lineSelected: 0xfcd34d, fillSelected: 0xfde68a,
  },
  sold: {
    line: 0x60a5fa, lineAlpha: 0.85,
    fill: 0x3b82f6, fillAlpha: 0.10,
    lineSelected: 0x93c5fd, fillSelected: 0x60a5fa,
  },
};

const toHex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

const BADGE_DIST_NEAR = 1500;
const BADGE_DIST_FAR = 7000;

function ParcelBadge({
  centroid,
  label,
  ariaLabel,
  status,
  isSelected,
  isHovered,
}: {
  centroid: Vector3;
  label: string;
  ariaLabel: string;
  status: string;
  isSelected: boolean;
  isHovered: boolean;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const pal = STATUS_PALETTE[status] ?? STATUS_PALETTE["for-sale"];
  const ringHex = toHex(isSelected ? pal.lineSelected : pal.line);
  const fillHex = toHex(pal.fillSelected);

  useFrame(({ camera }) => {
    const el = divRef.current;
    if (!el) return;
    const dist = camera.position.distanceTo(centroid);
    const t = Math.min(
      1,
      Math.max(0, (BADGE_DIST_FAR - dist) / (BADGE_DIST_FAR - BADGE_DIST_NEAR))
    );
    const distScale = 0.55 + t * 0.45;
    const stateScale = isSelected ? 1.08 : isHovered ? 1.04 : 1;
    el.style.transform = `scale(${(distScale * stateScale).toFixed(3)})`;
    el.style.opacity = t.toFixed(3);
  });

  const ringWidth = isSelected ? 2 : isHovered ? 1.5 : 1;
  const background = isSelected
    ? `${fillHex}d9` // ~85% alpha
    : "rgba(10, 10, 10, 0.78)";
  const boxShadow = `0 1px 6px rgba(0,0,0,0.45), inset 0 0 0 ${ringWidth}px ${ringHex}`;

  return (
    <Html
      position={centroid}
      center
      zIndexRange={[100, 0]}
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      <div
        ref={divRef}
        aria-label={ariaLabel}
        className="flex size-11 items-center justify-center rounded-full text-sm font-semibold text-white tabular-nums backdrop-blur-sm transition-[background-color,box-shadow] duration-200 ease-out will-change-transform"
        style={{
          backgroundColor: background,
          boxShadow,
          transformOrigin: "center",
        }}
      >
        {label}
      </div>
    </Html>
  );
}

function ParcelLayer({
  tilesRef,
  selectedId,
  onSelect,
}: {
  tilesRef: RefObject<TilesRendererImpl | null>;
  selectedId: string | null;
  onSelect: (f: ParcelFeature | null) => void;
}) {
  const parcelsRef = useRef<ParcelCollection | null>(null);
  const [renders, setRenders] = useState<ParcelRender[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/parcels", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: ParcelCollection) => {
        parcelsRef.current = data;
      })
      .catch(() => {});

    const pos = new Vector3();
    const interval = setInterval(() => {
      const tiles = tilesRef.current;
      const data = parcelsRef.current;
      if (!tiles?.ellipsoid || !data) return;
      clearInterval(interval);

      const built: ParcelRender[] = data.features.map((feature) => {
        const ring = feature.geometry.coordinates[0];

        // Line positions (visual outline — ring is already closed)
        const linePositions: number[] = [];
        for (const [lon, lat] of ring) {
          tiles.ellipsoid.getCartographicToPosition(lat * DEG2RAD, lon * DEG2RAD, 5, pos);
          linePositions.push(pos.x, pos.y, pos.z);
        }
        const lineGeom = new BufferGeometry();
        lineGeom.setAttribute("position", new Float32BufferAttribute(linePositions, 3));
        const line = new Line(lineGeom, new LineBasicMaterial({
          color: 0xfff9e8,
          opacity: 0.82,
          transparent: true,
          depthWrite: false,
          depthTest: false,
        }));
        line.renderOrder = 999;

        // Mesh positions — fan triangulation from vertex 0, skipping closing duplicate
        const n = ring.length - 1;
        const verts: Vector3[] = [];
        for (let i = 0; i < n; i++) {
          const [lon, lat] = ring[i];
          const v = new Vector3();
          tiles.ellipsoid.getCartographicToPosition(lat * DEG2RAD, lon * DEG2RAD, 5, v);
          verts.push(v);
        }
        const meshPos: number[] = [];
        for (let i = 1; i < n - 1; i++) {
          meshPos.push(verts[0].x, verts[0].y, verts[0].z);
          meshPos.push(verts[i].x, verts[i].y, verts[i].z);
          meshPos.push(verts[i + 1].x, verts[i + 1].y, verts[i + 1].z);
        }
        const meshGeom = new BufferGeometry();
        meshGeom.setAttribute("position", new Float32BufferAttribute(meshPos, 3));

        const fill = new MeshBasicMaterial({
          color: 0xfff9e8,
          transparent: true,
          opacity: 0.10,
          side: DoubleSide,
          depthWrite: false,
          depthTest: false,
        });

        // Centroid — mean of ring vertices (same 5m-above-terrain plane)
        const centroid = new Vector3();
        for (const v of verts) centroid.add(v);
        centroid.divideScalar(verts.length || 1);

        return { feature, line, fill, meshGeom, centroid };
      });

      setRenders(built);
    }, 200);

    return () => clearInterval(interval);
  }, [tilesRef]);

  // Update line + fill colors when selection or hover changes
  useEffect(() => {
    renders.forEach(({ feature, line, fill }) => {
      const mat = line.material as LineBasicMaterial;
      const isSelected = feature.properties.id === selectedId;
      const isHovered  = feature.properties.id === hoveredId;
      const status = feature.properties.status ?? "for-sale";
      const pal = STATUS_PALETTE[status] ?? STATUS_PALETTE["for-sale"];

      if (isSelected) {
        mat.color.setHex(pal.lineSelected);
        mat.opacity = 1;
        fill.color.setHex(pal.fillSelected);
        fill.opacity = pal.fillAlpha + 0.18;
      } else if (isHovered) {
        mat.color.setHex(pal.line);
        mat.opacity = 1;
        fill.color.setHex(pal.fill);
        fill.opacity = pal.fillAlpha + 0.08;
      } else {
        mat.color.setHex(pal.line);
        mat.opacity = pal.lineAlpha;
        fill.color.setHex(pal.fill);
        fill.opacity = pal.fillAlpha;
      }
      mat.needsUpdate = true;
      fill.needsUpdate = true;
    });
  }, [renders, selectedId, hoveredId]);

  // Dispose on unmount / re-build
  useEffect(() => {
    return () => {
      renders.forEach(({ line, fill, meshGeom }) => {
        line.geometry.dispose();
        (line.material as LineBasicMaterial).dispose();
        fill.dispose();
        meshGeom.dispose();
      });
    };
  }, [renders]);

  return (
    <>
      {renders.map(({ feature, line, fill, meshGeom, centroid }) => {
        const rawName = feature.properties.name || feature.properties.id;
        const shortLabel = rawName.replace(/^lote\s*/i, "").trim() || rawName;
        const status = feature.properties.status ?? "for-sale";
        return (
          <group key={feature.properties.id}>
            <primitive object={line} />
            <mesh
              geometry={meshGeom}
              material={fill}
              renderOrder={999}
              onPointerEnter={() => {
                document.body.style.cursor = "pointer";
                setHoveredId(feature.properties.id);
              }}
              onPointerLeave={() => {
                document.body.style.cursor = "";
                setHoveredId(null);
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(feature);
              }}
            />
            <ParcelBadge
              centroid={centroid}
              label={shortLabel}
              ariaLabel={rawName}
              status={status}
              isSelected={feature.properties.id === selectedId}
              isHovered={feature.properties.id === hoveredId}
            />
          </group>
        );
      })}
    </>
  );
}

const STATUS_TONE: Record<string, "emerald" | "amber" | "neutral"> = {
  "for-sale": "emerald",
  reserved: "amber",
  sold: "neutral",
};

function ParcelCard({
  parcel,
  onClose,
}: {
  parcel: ParcelFeature;
  onClose: () => void;
}) {
  const p = parcel.properties;
  const [expanded, setExpanded] = useState(false);
  const hasDetails = !!(p.description || p.contactUrl || p.zoning);

  return (
    <Panel className="pointer-events-auto absolute z-20 inset-x-0 bottom-0 mx-0 rounded-b-none pb-[env(safe-area-inset-bottom)] md:inset-x-auto md:bottom-4 md:right-[max(1rem,env(safe-area-inset-right))] md:mx-0 md:w-72 md:rounded-b-[var(--radius-xl)] md:pb-0">
      {/* Header — tappable on mobile to expand */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start justify-between px-4 pt-4 pb-3 text-left md:pointer-events-none"
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.18em] text-white/45">
              parcel
            </span>
            {p.status && (
              <Badge tone={STATUS_TONE[p.status] ?? "neutral"}>{p.status}</Badge>
            )}
          </div>
          <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.012em] text-white">
            {p.name}
          </h2>
        </div>
        <div className="ml-3 flex shrink-0 items-center gap-1">
          {hasDetails && (
            <span
              className={`text-[14px] text-white/40 transition-transform duration-200 md:hidden ${expanded ? "rotate-180" : ""}`}
              aria-hidden="true"
            >
              ▲
            </span>
          )}
          <span
            role="button"
            aria-label="Close"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="flex size-9 items-center justify-center rounded-full text-[18px] leading-none text-white/40 md:hover:bg-white/10 md:hover:text-white/80"
          >
            ×
          </span>
        </div>
      </button>

      {/* Stats row — always visible */}
      <div className="border-t border-[var(--color-hairline-dark)] px-4 py-3 text-[12px] text-white/65">
        <div className="flex justify-between">
          <span className="text-white/40 uppercase tracking-[0.14em] text-[10px]">
            area
          </span>
          <span className="font-mono tabular-nums">
            {formatAreaCompact(p.areaSqMeters)}
          </span>
        </div>
        {p.priceUSD ? (
          <div className="mt-1.5 flex justify-between">
            <span className="text-white/40 uppercase tracking-[0.14em] text-[10px]">
              price
            </span>
            <span className="font-mono tabular-nums text-white/90 text-[13px] font-medium">
              {formatPrice(p.priceUSD)}
            </span>
          </div>
        ) : null}
      </div>

      {/* Expandable details — hidden on mobile until tapped, always visible on md+ */}
      <div className={`overflow-hidden transition-[grid-template-rows] duration-200 ease-out grid md:grid-rows-[1fr] ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr] max-md:invisible"}`}>
        <div className="min-h-0">
          {p.zoning ? (
            <div className="border-t border-[var(--color-hairline-dark)] px-4 py-3 text-[12px] text-white/65">
              <div className="flex justify-between">
                <span className="text-white/40 uppercase tracking-[0.14em] text-[10px]">
                  zoning
                </span>
                <span>{p.zoning}</span>
              </div>
            </div>
          ) : null}

          {p.description ? (
            <div className="border-t border-[var(--color-hairline-dark)] px-4 py-3">
              <p className="text-[11px] leading-[1.6] text-white/55">
                {p.description}
              </p>
            </div>
          ) : null}

          {p.contactUrl ? (
            <div className="border-t border-[var(--color-hairline-dark)] px-4 py-3">
              <a
                href={p.contactUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-[var(--radius-md)] border border-[var(--color-hairline-dark)] py-2.5 text-center text-[12px] text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                contact
              </a>
            </div>
          ) : null}
        </div>
      </div>

      {/* Tap hint — mobile only, when collapsed */}
      {hasDetails && !expanded && (
        <div className="border-t border-[var(--color-hairline-dark)] py-2 text-center text-[10px] text-white/30 md:hidden">
          tap for details
        </div>
      )}
    </Panel>
  );
}

interface SceneProps {
  hourUTC: number;
  coverage: number;
  windSpeed: number;
  exposure: number;
  cameraPose: CameraPose;
  targetPose: CameraPose | null;
  shadowFarScale: number;
  shadowSplitLambda: number;
  shadowMapSize: number;
  showParcels: boolean;
  selectedParcelId: string | null;
  onParcelSelect: (f: ParcelFeature | null) => void;
}

function Scene({
  hourUTC,
  coverage,
  windSpeed,
  exposure,
  cameraPose,
  targetPose,
  shadowFarScale,
  shadowSplitLambda,
  shadowMapSize,
  showParcels,
  selectedParcelId,
  onParcelSelect,
}: SceneProps) {
  const tilesRef = useRef<TilesRendererImpl | null>(null);
  const timestamp = hourUTCToTimestamp(hourUTC);

  return (
    <>
      <AnimatedCamera tilesRef={tilesRef} initialPose={cameraPose} targetPose={targetPose} exposure={exposure} />
      {showParcels && (
        <ParcelLayer
          tilesRef={tilesRef}
          selectedId={selectedParcelId}
          onSelect={onParcelSelect}
        />
      )}

      <TilesRenderer ref={tilesRef}>
        <TilesPlugin
          plugin={GoogleCloudAuthPlugin}
          args={[{ apiToken: GOOGLE_MAPS_API_KEY, autoRefreshToken: true }]}
        />
        <TilesPlugin plugin={GLTFExtensionsPlugin} args={[{ dracoLoader }]} />
        <TilesPlugin plugin={TileCreasedNormalsPlugin} />
        <TilesPlugin plugin={TilesFadePlugin} />
        <TilesPlugin plugin={UpdateOnChangePlugin} />
        <GlobeControls enableDamping adjustHeight={false} />
      </TilesRenderer>

      <Atmosphere date={timestamp} correctAltitude>
        <EffectComposer multisampling={0} enableNormalPass>
          <Clouds
            coverage={coverage}
            localWeatherVelocity-x={windSpeed}
            shadow-farScale={shadowFarScale}
            shadow-maxFar={1e5}
            shadow-cascadeCount={2}
            shadow-mapSize={[shadowMapSize, shadowMapSize]}
            shadow-splitMode="practical"
            shadow-splitLambda={shadowSplitLambda}
          />
          <AerialPerspective sky sunLight skyLight />
          <LensFlare />
          <ToneMapping mode={ToneMappingMode.AGX} />
          <Dithering />
        </EffectComposer>
      </Atmosphere>
    </>
  );
}

function formatHourLabel(hourLocal: number) {
  const h = Math.floor(hourLocal);
  const m = Math.floor((hourLocal - h) * 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function ViewerV2() {
  const [hourLocal, setHourLocal] = useState(DEFAULTS.hourLocal);
  const [showParcels, setShowParcels] = useState(true);
  const [selectedParcel, setSelectedParcel] = useState<ParcelFeature | null>(null);

  const cameraPose = useMemo<CameraPose>(
    () => ({
      lat: DEFAULTS.cameraLat,
      lon: DEFAULTS.cameraLon,
      alt: DEFAULTS.cameraAltM,
      headingDeg: DEFAULTS.cameraHeadingDeg,
      pitchDeg: DEFAULTS.cameraPitchDeg,
    }),
    [],
  );

  const targetPose = useMemo<CameraPose | null>(
    () => (selectedParcel ? computeParcelTargetPose(selectedParcel) : null),
    [selectedParcel],
  );

  const hourUTC = hourLocal - URUGUAY_UTC_OFFSET_HOURS;
  const timeLabel = formatHourLabel(hourLocal);

  return (
    <div className="relative h-dvh w-dvw touch-none overflow-hidden bg-[#0b1016]">
      <Canvas
        dpr={[1, 2]}
        gl={{ depth: false }}
        camera={{ fov: 60, near: 10, far: 1e6 }}
        onPointerMissed={() => setSelectedParcel(null)}
      >
        <Scene
          hourUTC={hourUTC}
          coverage={DEFAULTS.coverage}
          windSpeed={DEFAULTS.windSpeed}
          exposure={DEFAULTS.exposure}
          cameraPose={cameraPose}
          targetPose={targetPose}
          shadowFarScale={DEFAULTS.shadowFarScale}
          shadowSplitLambda={DEFAULTS.shadowSplitLambda}
          shadowMapSize={DEFAULTS.shadowMapSize}
          showParcels={showParcels}
          selectedParcelId={selectedParcel?.properties.id ?? null}
          onParcelSelect={setSelectedParcel}
        />
      </Canvas>

      {selectedParcel && (
        <ParcelCard
          parcel={selectedParcel}
          onClose={() => setSelectedParcel(null)}
        />
      )}

      <div className="pointer-events-none absolute inset-x-0 top-[max(1.5rem,env(safe-area-inset-top))] z-20 flex justify-center px-4">
        <Panel className="pointer-events-auto flex w-full max-w-sm items-center gap-2 px-2 py-1.5 text-[13px] font-medium">
          <span className="shrink-0 px-1 text-white/60 max-sm:hidden">Time</span>
          <input
            type="range"
            min={0}
            max={24}
            step={0.01}
            value={hourLocal}
            onChange={(e) => setHourLocal(parseFloat(e.target.value))}
            className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-white outline-none [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
            aria-label="Time of day (Uruguay, UTC-3)"
          />
          <span className="shrink-0 font-mono tabular-nums text-white px-1">
            {timeLabel}
          </span>
          <span className="shrink-0 font-mono text-[12px] text-white/50 px-1 max-sm:hidden">UY</span>
          <button
            type="button"
            onClick={() => setShowParcels((v) => !v)}
            className={`size-9 shrink-0 rounded-[var(--radius-md)] text-[12px] font-medium transition-colors sm:h-8 sm:w-auto sm:px-3 ${
              showParcels
                ? "bg-white/12 text-white"
                : "text-white/60 hover:bg-white/10 hover:text-white"
            }`}
            aria-label="Toggle parcels"
          >
            <span className="max-sm:hidden">parcels</span>
            <span className="sm:hidden text-[16px]">◆</span>
          </button>
        </Panel>
      </div>

      <div className="pointer-events-none absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] z-20 flex items-center gap-3 text-[10px] uppercase tracking-[0.22em] text-white/50">
        <a
          href="/editor"
          className="pointer-events-auto text-white/40 transition-colors hover:text-white"
        >
          editor
        </a>
      </div>
    </div>
  );
}
