"use client";

import { useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
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
import { DrawOverlay } from "./draw-overlay";
import { INITIAL_CAMERA_POSITION } from "@/lib/constants";

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

      <Overlays parcelCount={parcels.features.length} />
      {drawMode && <DrawToolbar />}
    </div>
  );
}
