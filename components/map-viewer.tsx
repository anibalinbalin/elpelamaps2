"use client";

import { useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { GoogleTilesLayer } from "./google-tiles-layer";
import { GlobeClickHandler } from "./globe-click-handler";
import { ScreenProjector } from "./screen-projector";
import { ParcelPillsOverlay } from "./parcel-pills";
import { ParcelCard } from "./parcel-card";
import { TopBar } from "./top-bar";
import { getParcels } from "@/lib/parcels";
import { usePillPositions } from "@/lib/use-pill-positions";
import { CloudLayer } from "./cloud-layer";
import { INITIAL_CAMERA_POSITION } from "@/lib/constants";

function Overlays({ parcelCount }: { parcelCount: number }) {
  const positions = usePillPositions((s) => s.positions);
  const selectedPos = usePillPositions((s) => s.selectedPos);

  return (
    <>
      <TopBar parcelCount={parcelCount} />
      <ParcelPillsOverlay positions={positions} />
      {selectedPos && (
        <ParcelCard screenX={selectedPos.x} screenY={selectedPos.y} />
      )}
    </>
  );
}

export function MapViewer() {
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
        <color attach="background" args={["#111111"]} />
        <ambientLight intensity={1.5} />
        <directionalLight position={[1, 1, 1]} intensity={2} />
        <GoogleTilesLayer ref={tilesRef} apiToken={apiToken} />
        <GlobeClickHandler tilesRef={tilesRef} />
        <ScreenProjector tilesRef={tilesRef} />
        <CloudLayer />
      </Canvas>

      <Overlays parcelCount={parcels.features.length} />
    </div>
  );
}
