"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import type { RefObject } from "react";
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  MeshBasicMaterial,
  Vector3,
} from "three";
import { Canvas, useThree } from "@react-three/fiber";
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

function CameraFrame({
  tilesRef,
  pose,
  exposure,
}: {
  tilesRef: RefObject<TilesRendererImpl | null>;
  pose: CameraPose;
  exposure: number;
}) {
  const { camera, gl } = useThree();

  useEffect(() => {
    gl.toneMappingExposure = exposure;
  }, [gl, exposure]);

  useEffect(() => {
    const apply = () => {
      const tiles = tilesRef.current;
      if (!tiles?.ellipsoid) return false;
      tiles.ellipsoid.getObjectFrame(
        pose.lat * DEG2RAD,
        pose.lon * DEG2RAD,
        pose.alt,
        pose.headingDeg * DEG2RAD,
        pose.pitchDeg * DEG2RAD,
        0,
        camera.matrix,
        CAMERA_FRAME,
      );
      camera.matrix.decompose(camera.position, camera.quaternion, camera.scale);
      camera.updateMatrixWorld(true);
      return true;
    };

    if (apply()) return;
    const interval = setInterval(() => {
      if (apply()) clearInterval(interval);
    }, 100);
    return () => clearInterval(interval);
  }, [camera, tilesRef, pose]);

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
        const label = feature.properties.name || feature.properties.id;
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
            <Html
              position={centroid}
              center
              zIndexRange={[100, 0]}
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              <div className="flex size-11 items-center justify-center rounded-full bg-white/95 text-xs font-semibold text-neutral-900 shadow-md ring-1 ring-black/10 tabular-nums">
                {label}
              </div>
            </Html>
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
  return (
    <Panel className="pointer-events-auto absolute bottom-4 right-4 z-20 w-72">
      <div className="flex items-start justify-between px-4 pt-4 pb-3">
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
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="ml-3 mt-0.5 shrink-0 text-[18px] leading-none text-white/40 transition-colors hover:text-white/80"
        >
          ×
        </button>
      </div>

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
        {p.zoning ? (
          <div className="mt-1.5 flex justify-between">
            <span className="text-white/40 uppercase tracking-[0.14em] text-[10px]">
              zoning
            </span>
            <span>{p.zoning}</span>
          </div>
        ) : null}
      </div>

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
            className="block rounded-[var(--radius-md)] border border-[var(--color-hairline-dark)] py-2 text-center text-[12px] text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            contact
          </a>
        </div>
      ) : null}
    </Panel>
  );
}

interface SceneProps {
  hourUTC: number;
  coverage: number;
  windSpeed: number;
  exposure: number;
  cameraPose: CameraPose;
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
      <CameraFrame tilesRef={tilesRef} pose={cameraPose} exposure={exposure} />
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

  const hourUTC = hourLocal - URUGUAY_UTC_OFFSET_HOURS;
  const timeLabel = formatHourLabel(hourLocal);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0b1016]">
      <Canvas
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

      <div className="pointer-events-none absolute inset-x-0 top-6 z-20 flex justify-center">
        <Panel className="pointer-events-auto flex items-center gap-2 px-2 py-1 text-[13px] font-medium">
          <span className="px-2 text-white/60">Time</span>
          <input
            type="range"
            min={0}
            max={24}
            step={0.01}
            value={hourLocal}
            onChange={(e) => setHourLocal(parseFloat(e.target.value))}
            className="h-1.5 w-72 cursor-pointer appearance-none rounded-full bg-white/10 accent-white outline-none"
            aria-label="Time of day (Uruguay, UTC-3)"
          />
          <span className="font-mono tabular-nums text-white px-1">
            {timeLabel}
          </span>
          <span className="font-mono text-[12px] text-white/50 px-1">UY</span>
          <button
            type="button"
            onClick={() => setShowParcels((v) => !v)}
            className={`h-8 px-3 rounded-[var(--radius-md)] text-[12px] font-medium transition-colors ${
              showParcels
                ? "bg-white/12 text-white"
                : "text-white/60 hover:bg-white/10 hover:text-white"
            }`}
          >
            parcels
          </button>
        </Panel>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 z-20 flex items-center gap-3 text-[10px] uppercase tracking-[0.22em] text-white/50">
        <span>
          viewer v2 · takram atmosphere + clouds · google photorealistic 3d
          tiles
        </span>
        <span className="text-white/25">·</span>
        <a
          href="/editor-v2"
          className="pointer-events-auto text-white/40 transition-colors hover:text-white"
        >
          editor
        </a>
      </div>
    </div>
  );
}
