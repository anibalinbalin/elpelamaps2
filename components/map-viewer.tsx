"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CesiumPublicViewer } from "./cesium-public-viewer";
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
import {
  INITIAL_CAMERA_POSITION,
  VIEWER_LIGHTING_DIRECTIONS,
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
};

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

const NATURAL_DEPTH = VIEWER_LIGHTING_DIRECTIONS["natural-depth"];

export function MapViewer({ drawMode = false }: MapViewerProps) {
  if (!drawMode) {
    return <CesiumPublicViewer />;
  }

  return <DrawModeMapViewer />;
}

function DrawModeMapViewer() {
  const apiToken = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const tilesRef = useRef<any>(null);
  const parcels = useParcelData({ includeDraftParcels: true });
  const [camPos, setCamPos] = useState("");
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
      <Canvas
        camera={{ position: INITIAL_CAMERA_POSITION, near: 1, far: 4e7 }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, powerPreference: "high-performance" }}
      >
        <CameraDebug onUpdate={setCamPos} />
        <AtmosphereLayer
          tilesRef={tilesRef}
          cloudMotionPreset="subtle"
          cloudSwooshTick={cloudSwooshTick}
          cloudsCleared={cloudsCleared}
          lightingDirection="natural-depth"
        >
          <GoogleTilesLayer
            ref={tilesRef}
            apiToken={apiToken}
            tileRelief={NATURAL_DEPTH.tileRelief}
            terrainDisplacementScale={NATURAL_DEPTH.terrainDisplacementScale}
          >
            <ParcelLayer tilesRef={tilesRef} />
          </GoogleTilesLayer>
          <GlobeClickHandler tilesRef={tilesRef} />
          <ScreenProjector tilesRef={tilesRef} />
          <AdminEditCamera tilesRef={tilesRef} />
        </AtmosphereLayer>
      </Canvas>
      <AtmosphericWashOverlay />

      {process.env.NODE_ENV === "development" && camPos && (
        <div className="fixed bottom-2 right-2 z-50 rounded bg-black/80 px-3 py-1.5 font-mono text-xs text-white/80 select-all backdrop-blur">
          camera: {camPos}
        </div>
      )}
      <Overlays
        drawMode={true}
        parcelCount={parcels.features.length}
        cloudSwooshTick={cloudSwooshTick}
        cloudsCleared={cloudsCleared}
        isCloudSwooshing={isCloudSwooshing}
        onSwooshClouds={handleCloudSwoosh}
      />
      <DrawToolbar />
    </div>
  );
}
