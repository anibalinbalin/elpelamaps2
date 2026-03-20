"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { GoogleTilesLayer } from "./google-tiles-layer";
import { GlobeClickHandler } from "./globe-click-handler";
import { ScreenProjector } from "./screen-projector";
import { ParcelPillsOverlay } from "./parcel-pills";
import { ParcelSidebar } from "./parcel-sidebar";
import { TopBar } from "./top-bar";
import { usePillPositions } from "@/lib/use-pill-positions";
import { ParcelLayer } from "./parcel-layer";
import { AtmosphereLayer } from "./atmosphere-layer";
import { DrawToolbar } from "./draw-toolbar";
import { DrawOverlay, DrawOverlayDOM } from "./draw-overlay";
import {
  DEFAULT_VIEWER_LIGHTING_DIRECTION,
  INITIAL_CAMERA_POSITION,
  VIEWER_LIGHTING_DIRECTIONS,
  type ViewerLightingDirectionId,
} from "@/lib/constants";
import { useParcelData } from "@/lib/use-parcel-data";
import { AdminEditCamera } from "./admin-edit-camera";

function CameraDebug({ onUpdate }: { onUpdate: (pos: string) => void }) {
  const { camera } = useThree();
  const lastUpdate = useRef(0);
  useFrame((state) => {
    const now = state.clock.elapsedTime;
    if (now - lastUpdate.current < 0.5) return;
    lastUpdate.current = now;
    const p = camera.position;
    onUpdate(`[${Math.round(p.x)}, ${Math.round(p.y)}, ${Math.round(p.z)}]`);
  });
  return null;
}

interface MapViewerProps {
  drawMode?: boolean;
}

const LIGHTING_WASHES: Record<
  ViewerLightingDirectionId,
  {
    sky: CSSProperties;
    horizon: CSSProperties;
    vignette: CSSProperties;
  }
> = {
  "natural-depth": {
    sky: {
      background: [
        "radial-gradient(ellipse at 50% -18%, rgba(255, 244, 215, 0.17), rgba(255, 244, 215, 0.06) 24%, rgba(255, 244, 215, 0) 56%)",
        "linear-gradient(180deg, rgba(88, 145, 212, 0.18) 0%, rgba(126, 182, 226, 0.12) 18%, rgba(161, 206, 234, 0.06) 34%, rgba(192, 219, 233, 0.02) 52%, rgba(192, 219, 233, 0) 66%)",
        "linear-gradient(180deg, rgba(255, 235, 194, 0) 48%, rgba(255, 235, 194, 0.07) 70%, rgba(255, 235, 194, 0.12) 82%, rgba(255, 235, 194, 0.06) 92%, rgba(255, 235, 194, 0) 100%)",
      ].join(", "),
    },
    horizon: {
      inset: "42% -9% 12% -9%",
      background: [
        "linear-gradient(180deg, rgba(174, 214, 245, 0) 0%, rgba(174, 214, 245, 0.1) 22%, rgba(201, 227, 244, 0.18) 40%, rgba(229, 214, 184, 0.18) 58%, rgba(229, 214, 184, 0.07) 72%, rgba(229, 214, 184, 0) 100%)",
        "radial-gradient(ellipse at 50% 58%, rgba(238, 223, 191, 0.24), rgba(238, 223, 191, 0.11) 36%, rgba(238, 223, 191, 0) 72%)",
      ].join(", "),
      filter: "blur(38px)",
      opacity: 0.88,
      transform: "scale(1.04)",
    },
    vignette: {
      background: [
        "linear-gradient(180deg, rgba(255, 252, 246, 0.045) 0%, rgba(255, 252, 246, 0.015) 16%, rgba(255, 252, 246, 0) 34%, rgba(17, 24, 31, 0.012) 100%)",
        "radial-gradient(circle at 50% 44%, rgba(255, 255, 255, 0) 50%, rgba(17, 24, 31, 0.02) 82%, rgba(13, 18, 24, 0.052) 100%)",
      ].join(", "),
    },
  },
  "cinematic-depth": {
    sky: {
      background: [
        "radial-gradient(ellipse at 74% -14%, rgba(255, 218, 159, 0.22), rgba(255, 218, 159, 0.08) 18%, rgba(255, 218, 159, 0) 48%)",
        "linear-gradient(180deg, rgba(26, 56, 96, 0.26) 0%, rgba(64, 104, 150, 0.18) 18%, rgba(129, 167, 198, 0.08) 36%, rgba(129, 167, 198, 0) 54%)",
        "linear-gradient(180deg, rgba(255, 204, 132, 0) 42%, rgba(255, 204, 132, 0.16) 62%, rgba(255, 204, 132, 0.24) 78%, rgba(255, 204, 132, 0.12) 90%, rgba(255, 204, 132, 0) 100%)",
      ].join(", "),
    },
    horizon: {
      inset: "39% -8% 10% -8%",
      background: [
        "linear-gradient(180deg, rgba(151, 191, 220, 0) 0%, rgba(151, 191, 220, 0.06) 14%, rgba(199, 216, 222, 0.18) 28%, rgba(240, 189, 121, 0.3) 46%, rgba(240, 189, 121, 0.24) 60%, rgba(240, 189, 121, 0.09) 76%, rgba(240, 189, 121, 0) 100%)",
        "radial-gradient(ellipse at 58% 58%, rgba(255, 211, 146, 0.34), rgba(255, 211, 146, 0.16) 32%, rgba(255, 211, 146, 0) 70%)",
      ].join(", "),
      filter: "blur(54px)",
      opacity: 1,
      transform: "scale(1.1)",
    },
    vignette: {
      background: [
        "linear-gradient(180deg, rgba(5, 18, 33, 0.14) 0%, rgba(5, 18, 33, 0.03) 18%, rgba(255, 255, 255, 0) 34%, rgba(7, 18, 30, 0.034) 100%)",
        "radial-gradient(circle at 54% 44%, rgba(255, 255, 255, 0) 46%, rgba(8, 20, 35, 0.04) 78%, rgba(4, 12, 22, 0.1) 100%)",
      ].join(", "),
    },
  },
};

function AtmosphericWashOverlay({
  lightingDirection,
}: {
  lightingDirection: ViewerLightingDirectionId;
}) {
  const wash = LIGHTING_WASHES[lightingDirection];

  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={wash.sky}
      />
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={wash.horizon}
      />
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={wash.vignette}
      />
    </>
  );
}

function LightingDirectionToggle({
  lightingDirection,
  onChange,
}: {
  lightingDirection: ViewerLightingDirectionId;
  onChange: (value: ViewerLightingDirectionId) => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-20 flex justify-center px-4 max-sm:bottom-4">
      <div className="pointer-events-auto flex w-full max-w-[980px] flex-wrap items-stretch gap-2 rounded-[30px] border border-white/12 bg-[rgba(18,24,32,0.72)] p-2 text-white shadow-[0_24px_70px_rgba(4,16,28,0.28)] backdrop-blur-xl">
        <div className="flex min-w-[132px] flex-1 flex-col justify-center px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/42">
            Depth
          </div>
          <div className="mt-1 text-[13px] text-white/62">
            Compare grounded versus more art-directed terrain depth.
          </div>
        </div>

        {(Object.keys(VIEWER_LIGHTING_DIRECTIONS) as ViewerLightingDirectionId[]).map(
          (direction) => {
            const preset = VIEWER_LIGHTING_DIRECTIONS[direction];
            const active = lightingDirection === direction;

            return (
              <button
                key={direction}
                type="button"
                onClick={() => onChange(direction)}
                className={`min-h-12 min-w-[220px] flex-1 rounded-[22px] border px-4 py-3 text-left transition-colors duration-200 ${
                  active
                    ? "border-white/22 bg-white/[0.12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    : "border-white/8 bg-white/[0.03] text-white/76 hover:border-white/14 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                <div className="text-[14px] font-semibold tracking-[-0.02em]">
                  {preset.label}
                </div>
                <div className="mt-1 text-[11px] leading-4 text-white/52">
                  {preset.description}
                </div>
              </button>
            );
          },
        )}
      </div>
    </div>
  );
}

function Overlays({
  drawMode,
  parcelCount,
  cloudSwooshTick,
  cloudsCleared,
  isCloudSwooshing,
  onSwooshClouds,
}: {
  drawMode: boolean;
  parcelCount: number;
  cloudSwooshTick: number;
  cloudsCleared: boolean;
  isCloudSwooshing: boolean;
  onSwooshClouds: () => void;
}) {
  const positions = usePillPositions((s) => s.positions);

  return (
    <>
      <TopBar
        drawMode={drawMode}
        parcelCount={parcelCount}
        cloudSwooshTick={cloudSwooshTick}
        cloudsCleared={cloudsCleared}
        isCloudSwooshing={isCloudSwooshing}
        onSwooshClouds={onSwooshClouds}
      />
      <ParcelPillsOverlay positions={positions} />
      <ParcelSidebar />
    </>
  );
}

export function MapViewer({ drawMode = false }: MapViewerProps) {
  const apiToken = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const tilesRef = useRef<any>(null);
  const parcels = useParcelData();
  const [camPos, setCamPos] = useState("");
  const [lightingDirection, setLightingDirection] =
    useState<ViewerLightingDirectionId>(DEFAULT_VIEWER_LIGHTING_DIRECTION);
  const [cloudSwooshTick, setCloudSwooshTick] = useState(0);
  const [cloudsCleared, setCloudsCleared] = useState(false);
  const [isCloudSwooshing, setIsCloudSwooshing] = useState(false);
  const cloudSwooshTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (cloudSwooshTimeoutRef.current != null) {
        window.clearTimeout(cloudSwooshTimeoutRef.current);
      }
    };
  }, []);

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

  if (!apiToken || apiToken === "YOUR_API_KEY_HERE") {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a] text-sm text-white/50">
        Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen">
      <Canvas camera={{ position: INITIAL_CAMERA_POSITION, near: 1, far: 4e7 }}>
        <CameraDebug onUpdate={setCamPos} />
        <AtmosphereLayer
          tilesRef={tilesRef}
          cloudMotionPreset={
            lightingDirection === "natural-depth" ? "subtle" : "cinematic"
          }
          cloudSwooshTick={cloudSwooshTick}
          cloudsCleared={cloudsCleared}
          lightingDirection={lightingDirection}
        >
          <GoogleTilesLayer
            ref={tilesRef}
            apiToken={apiToken}
            tileRelief={
              VIEWER_LIGHTING_DIRECTIONS[lightingDirection].tileRelief
            }
            terrainDisplacementScale={
              VIEWER_LIGHTING_DIRECTIONS[lightingDirection].terrainDisplacementScale
            }
          >
            <ParcelLayer />
          </GoogleTilesLayer>
          <GlobeClickHandler tilesRef={tilesRef} />
          <ScreenProjector tilesRef={tilesRef} />
          {drawMode && <AdminEditCamera tilesRef={tilesRef} />}
          {drawMode && <DrawOverlay tilesRef={tilesRef} />}
        </AtmosphereLayer>
      </Canvas>
      <AtmosphericWashOverlay lightingDirection={lightingDirection} />

      {process.env.NODE_ENV === "development" && camPos && (
        <div className="fixed bottom-2 right-2 z-50 rounded bg-black/80 px-3 py-1.5 font-mono text-xs text-white/80 select-all backdrop-blur">
          camera: {camPos}
        </div>
      )}
      <Overlays
        drawMode={drawMode}
        parcelCount={parcels.features.length}
        cloudSwooshTick={cloudSwooshTick}
        cloudsCleared={cloudsCleared}
        isCloudSwooshing={isCloudSwooshing}
        onSwooshClouds={handleCloudSwoosh}
      />
      {!drawMode && (
        <LightingDirectionToggle
          lightingDirection={lightingDirection}
          onChange={setLightingDirection}
        />
      )}
      {drawMode && <DrawOverlayDOM />}
      {drawMode && <DrawToolbar />}
    </div>
  );
}
