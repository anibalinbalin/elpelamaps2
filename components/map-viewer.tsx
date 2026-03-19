"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { GoogleTilesLayer } from "./google-tiles-layer";
import { GlobeClickHandler } from "./globe-click-handler";
import { ScreenProjector } from "./screen-projector";
import { ParcelPillsOverlay } from "./parcel-pills";
import { ParcelSidebar } from "./parcel-sidebar";
import { TopBar } from "./top-bar";
import { getParcels } from "@/lib/parcels";
import { usePillPositions } from "@/lib/use-pill-positions";
import { ParcelLayer } from "./parcel-layer";
import { AtmosphereLayer } from "./atmosphere-layer";
import { CloudLayer } from "./cloud-layer";
import { CesiumTerrainLayer } from "./cesium-terrain-layer";
import { MapboxTerrainLayer } from "./mapbox-terrain-layer";
import { DrawToolbar } from "./draw-toolbar";
import { DrawOverlay, DrawOverlayDOM } from "./draw-overlay";
import { INITIAL_CAMERA_POSITION } from "@/lib/constants";

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

function Overlays({ parcelCount }: { parcelCount: number }) {
  const positions = usePillPositions((s) => s.positions);

  return (
    <>
      <TopBar parcelCount={parcelCount} />
      <ParcelPillsOverlay positions={positions} />
      <ParcelSidebar />
    </>
  );
}

export function MapViewer({ drawMode = false }: MapViewerProps) {
  const apiToken = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const tilesRef = useRef<any>(null);
  const parcels = useMemo(() => getParcels(), []);
  const [camPos, setCamPos] = useState("");

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
        <AtmosphereLayer>
          <GoogleTilesLayer ref={tilesRef} apiToken={apiToken}>
            <ParcelLayer />
          </GoogleTilesLayer>
          <CesiumTerrainLayer />
          <GlobeClickHandler tilesRef={tilesRef} />
          <ScreenProjector tilesRef={tilesRef} />
          <CloudLayer />
          {drawMode && <DrawOverlay tilesRef={tilesRef} />}
        </AtmosphereLayer>
      </Canvas>

      {process.env.NODE_ENV === "development" && camPos && (
        <div className="fixed bottom-2 right-2 z-50 rounded bg-black/80 px-3 py-1.5 font-mono text-xs text-white/80 select-all backdrop-blur">
          camera: {camPos}
        </div>
      )}
      <Overlays parcelCount={parcels.features.length} />
      {drawMode && <DrawOverlayDOM />}
      {drawMode && <DrawToolbar />}
    </div>
  );
}
