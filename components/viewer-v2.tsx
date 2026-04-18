"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { Matrix4, Vector3 } from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
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
  const tilesReadyRef = useRef(false);

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

    if (apply()) {
      tilesReadyRef.current = true;
      return;
    }
    const interval = setInterval(() => {
      if (apply()) {
        tilesReadyRef.current = true;
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [camera, tilesRef, pose]);

  return null;
}

function hourUTCToTimestamp(hourUTC: number) {
  return Date.UTC(REFERENCE_YEAR, REFERENCE_MONTH, REFERENCE_DAY) +
    hourUTC * 3600000;
}

interface CameraReadoutState {
  lat: number;
  lon: number;
  alt: number;
  heading: number;
  pitch: number;
}

function CameraReadout({
  tilesRef,
  readoutRef,
}: {
  tilesRef: RefObject<TilesRendererImpl | null>;
  readoutRef: RefObject<CameraReadoutState>;
}) {
  const { camera } = useThree();
  const enuRef = useRef(new Matrix4());
  const enuInvRef = useRef(new Matrix4());
  const forwardRef = useRef(new Vector3());
  const cartRef = useRef({ lat: 0, lon: 0, height: 0 });

  useFrame(() => {
    const tiles = tilesRef.current;
    if (!tiles?.ellipsoid) return;

    tiles.ellipsoid.getPositionToCartographic(camera.position, cartRef.current);
    const { lat, lon, height } = cartRef.current;

    tiles.ellipsoid.getEastNorthUpFrame(lat, lon, 0, enuRef.current);
    enuInvRef.current.copy(enuRef.current).invert();
    forwardRef.current.set(0, 0, -1).applyQuaternion(camera.quaternion);
    forwardRef.current.transformDirection(enuInvRef.current);
    const fx = forwardRef.current.x;
    const fy = forwardRef.current.y;
    const fz = forwardRef.current.z;
    const horiz = Math.hypot(fx, fy);
    const headingRad = Math.atan2(fx, fy);
    const pitchRad = Math.atan2(fz, horiz);

    readoutRef.current = {
      lat: lat / DEG2RAD,
      lon: lon / DEG2RAD,
      alt: height,
      heading: ((headingRad / DEG2RAD) + 360) % 360,
      pitch: pitchRad / DEG2RAD,
    };
  });

  return null;
}

function CameraReadoutPanel({
  readoutRef,
}: {
  readoutRef: RefObject<CameraReadoutState>;
}) {
  const [state, setState] = useState<CameraReadoutState>(readoutRef.current);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setState({ ...readoutRef.current }), 200);
    return () => window.clearInterval(id);
  }, [readoutRef]);

  return (
    <div className="pointer-events-auto absolute left-4 top-4 z-20 w-[260px] rounded-2xl border border-white/10 bg-black/55 px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-white/70 shadow-[0_18px_48px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold text-white/80">camera</span>
        <button
          type="button"
          onClick={() => {
            const payload = {
              lat: Number(state.lat.toFixed(6)),
              lon: Number(state.lon.toFixed(6)),
              alt: Number(state.alt.toFixed(1)),
              heading: Number(state.heading.toFixed(2)),
              pitch: Number(state.pitch.toFixed(2)),
            };
            navigator.clipboard
              .writeText(JSON.stringify(payload, null, 2))
              .then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1200);
              })
              .catch(() => {});
          }}
          className="rounded-full border border-white/15 px-2 py-0.5 text-[9px] tracking-[0.2em] text-white/75 transition-colors hover:border-white/40 hover:text-white"
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-white/85">
        <dt className="text-white/45">lat</dt>
        <dd className="text-right tabular-nums">{state.lat.toFixed(6)}</dd>
        <dt className="text-white/45">lon</dt>
        <dd className="text-right tabular-nums">{state.lon.toFixed(6)}</dd>
        <dt className="text-white/45">alt</dt>
        <dd className="text-right tabular-nums">{state.alt.toFixed(1)}m</dd>
        <dt className="text-white/45">heading</dt>
        <dd className="text-right tabular-nums">
          {state.heading.toFixed(2)}°
        </dd>
        <dt className="text-white/45">pitch</dt>
        <dd className="text-right tabular-nums">{state.pitch.toFixed(2)}°</dd>
      </dl>
    </div>
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
  readoutRef: RefObject<CameraReadoutState>;
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
  readoutRef,
}: SceneProps) {
  const tilesRef = useRef<TilesRendererImpl | null>(null);
  const timestamp = hourUTCToTimestamp(hourUTC);

  return (
    <>
      <CameraFrame tilesRef={tilesRef} pose={cameraPose} exposure={exposure} />
      <CameraReadout tilesRef={tilesRef} readoutRef={readoutRef} />

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

interface DialRowProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  onDoubleClick?: () => void;
}

function DialRow({
  label,
  min,
  max,
  step,
  value,
  format,
  onChange,
  onDoubleClick,
}: DialRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const commit = () => {
    const parsed = parseFloat(draft);
    if (!isNaN(parsed)) onChange(Math.min(max, Math.max(min, parsed)));
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.14em] text-white/65">
      <span className="w-20 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onDoubleClick={onDoubleClick}
        className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-white/90 outline-none"
      />
      {editing ? (
        <input
          type="text"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-14 shrink-0 rounded bg-white/10 px-1 text-right tabular-nums text-white/90 outline-none"
        />
      ) : (
        <button
          type="button"
          title="Click to enter exact value"
          onClick={() => { setDraft(String(value)); setEditing(true); }}
          className="w-14 shrink-0 cursor-text text-right tabular-nums text-white/85 hover:text-white"
        >
          {format ? format(value) : value.toFixed(2)}
        </button>
      )}
    </div>
  );
}

export function ViewerV2() {
  const [hourLocal, setHourLocal] = useState(DEFAULTS.hourLocal);
  const [coverage, setCoverage] = useState(DEFAULTS.coverage);
  const [windSpeed, setWindSpeed] = useState(DEFAULTS.windSpeed);
  const [exposure, setExposure] = useState(DEFAULTS.exposure);
  const [cameraPitch, setCameraPitch] = useState(DEFAULTS.cameraPitchDeg);
  const [cameraAlt, setCameraAlt] = useState(DEFAULTS.cameraAltM);
  const [cameraHeading, setCameraHeading] = useState(DEFAULTS.cameraHeadingDeg);
  const cameraPose = useMemo<CameraPose>(
    () => ({
      lat: DEFAULTS.cameraLat,
      lon: DEFAULTS.cameraLon,
      alt: cameraAlt,
      headingDeg: cameraHeading,
      pitchDeg: cameraPitch,
    }),
    [cameraAlt, cameraHeading, cameraPitch],
  );
  const [shadowFarScale, setShadowFarScale] = useState(DEFAULTS.shadowFarScale);
  const [shadowSplitLambda, setShadowSplitLambda] = useState(
    DEFAULTS.shadowSplitLambda,
  );
  const [shadowMapSize, setShadowMapSize] = useState(DEFAULTS.shadowMapSize);
  const [panelOpen, setPanelOpen] = useState(true);
  const readoutRef = useRef<CameraReadoutState>({
    lat: 0,
    lon: 0,
    alt: 0,
    heading: 0,
    pitch: 0,
  });

  const hourUTC = hourLocal - URUGUAY_UTC_OFFSET_HOURS;
  const timeLabel = formatHourLabel(hourLocal);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0b1016]">
      <Canvas gl={{ depth: false }} camera={{ fov: 60, near: 10, far: 1e6 }}>
        <Scene
          hourUTC={hourUTC}
          coverage={coverage}
          windSpeed={windSpeed}
          exposure={exposure}
          cameraPose={cameraPose}
          shadowFarScale={shadowFarScale}
          shadowSplitLambda={shadowSplitLambda}
          shadowMapSize={shadowMapSize}
          readoutRef={readoutRef}
        />
      </Canvas>

      <div className="pointer-events-none absolute inset-x-0 top-6 z-20 flex justify-center">
        <div className="pointer-events-auto flex items-center gap-4 rounded-full border border-white/10 bg-black/45 px-5 py-2 text-[11px] font-medium uppercase tracking-[0.18em] text-white/80 shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <span className="text-white/55">time</span>
          <input
            type="range"
            min={0}
            max={24}
            step={0.01}
            value={hourLocal}
            onChange={(e) => setHourLocal(parseFloat(e.target.value))}
            className="h-1.5 w-72 cursor-pointer appearance-none rounded-full bg-white/15 accent-white/90 outline-none"
            aria-label="Time of day (Uruguay, UTC-3)"
          />
          <span className="tabular-nums text-white/85">{timeLabel}</span>
          <span className="text-[9px] tracking-[0.18em] text-white/40">
            uruguay
          </span>
        </div>
      </div>

      <div className="pointer-events-auto absolute bottom-4 right-4 z-20 w-[320px] overflow-hidden rounded-2xl border border-white/10 bg-black/55 text-white/85 shadow-[0_18px_48px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/75 transition-colors hover:text-white"
        >
          <span>inspector</span>
          <span className="text-white/45">{panelOpen ? "–" : "+"}</span>
        </button>
        {panelOpen ? (
          <div className="flex flex-col gap-3 px-4 pb-4">
            <DialRow
              label="coverage"
              min={0}
              max={0.9}
              step={0.01}
              value={coverage}
              onChange={setCoverage}
              onDoubleClick={() => setCoverage(DEFAULTS.coverage)}
              format={(v) => v.toFixed(2)}
            />
            <DialRow
              label="wind"
              min={0}
              max={0.01}
              step={0.0001}
              value={windSpeed}
              onChange={setWindSpeed}
              onDoubleClick={() => setWindSpeed(DEFAULTS.windSpeed)}
              format={(v) => (v * 1000).toFixed(2)}
            />
            <DialRow
              label="exposure"
              min={1}
              max={20}
              step={0.1}
              value={exposure}
              onChange={setExposure}
              onDoubleClick={() => setExposure(DEFAULTS.exposure)}
              format={(v) => v.toFixed(1)}
            />
            <DialRow
              label="cam pitch"
              min={-89}
              max={-10}
              step={0.5}
              value={cameraPitch}
              onChange={setCameraPitch}
              onDoubleClick={() => setCameraPitch(DEFAULTS.cameraPitchDeg)}
              format={(v) => `${v.toFixed(1)}°`}
            />
            <DialRow
              label="cam alt"
              min={200}
              max={8000}
              step={10}
              value={cameraAlt}
              onChange={setCameraAlt}
              onDoubleClick={() => setCameraAlt(DEFAULTS.cameraAltM)}
              format={(v) => `${v.toFixed(0)}m`}
            />
            <DialRow
              label="cam heading"
              min={0}
              max={360}
              step={1}
              value={cameraHeading}
              onChange={setCameraHeading}
              onDoubleClick={() =>
                setCameraHeading(DEFAULTS.cameraHeadingDeg)
              }
              format={(v) => `${v.toFixed(0)}°`}
            />
            <DialRow
              label="shadow far"
              min={0.05}
              max={1}
              step={0.01}
              value={shadowFarScale}
              onChange={setShadowFarScale}
              onDoubleClick={() => setShadowFarScale(DEFAULTS.shadowFarScale)}
              format={(v) => v.toFixed(2)}
            />
            <DialRow
              label="split λ"
              min={0}
              max={1}
              step={0.01}
              value={shadowSplitLambda}
              onChange={setShadowSplitLambda}
              onDoubleClick={() =>
                setShadowSplitLambda(DEFAULTS.shadowSplitLambda)
              }
              format={(v) => v.toFixed(2)}
            />
            <DialRow
              label="shadow res"
              min={128}
              max={2048}
              step={128}
              value={shadowMapSize}
              onChange={setShadowMapSize}
              onDoubleClick={() => setShadowMapSize(DEFAULTS.shadowMapSize)}
              format={(v) => `${v}px`}
            />
            <p className="pt-1 text-[9px] uppercase tracking-[0.18em] text-white/35">
              double-click a dial to reset
            </p>
          </div>
        ) : null}
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 z-20 text-[10px] uppercase tracking-[0.22em] text-white/45">
        viewer v2 · takram atmosphere + clouds · google photorealistic 3d tiles
      </div>

      <CameraReadoutPanel readoutRef={readoutRef} />
    </div>
  );
}
