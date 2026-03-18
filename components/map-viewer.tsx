"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { GoogleTilesLayer } from "./google-tiles-layer";
import { ParcelLayer } from "./parcel-layer";
import { GlobeClickHandler } from "./globe-click-handler";
import { ScreenProjector } from "./screen-projector";
import { ParcelPillsOverlay, type PillPosition } from "./parcel-pills";
import { ParcelCard } from "./parcel-card";
import { TopBar } from "./top-bar";
import { getParcels } from "@/lib/parcels";
import { INITIAL_CAMERA_POSITION } from "@/lib/constants";

export function MapViewer() {
  const apiToken = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const tilesRef = useRef<any>(null);
  const parcels = useMemo(() => getParcels(), []);

  const [pillPositions, setPillPositions] = useState<PillPosition[]>([]);
  const [selectedScreenPos, setSelectedScreenPos] = useState<{ x: number; y: number } | null>(null);

  const handleProjectionUpdate = useCallback(
    (pills: PillPosition[], selPos: { x: number; y: number } | null) => {
      setPillPositions(pills);
      setSelectedScreenPos(selPos);
    },
    []
  );

  if (!apiToken || apiToken === "YOUR_API_KEY_HERE") {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a] text-sm text-white/50">
        Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen">
      <Canvas camera={{ position: INITIAL_CAMERA_POSITION }} flat frameloop="demand">
        <color attach="background" args={[0x111111]} />
        <ambientLight intensity={1} />
        <GoogleTilesLayer ref={tilesRef} apiToken={apiToken}>
          <ParcelLayer />
        </GoogleTilesLayer>
        <GlobeClickHandler tilesRef={tilesRef} />
        <ScreenProjector tilesRef={tilesRef} onUpdate={handleProjectionUpdate} />
      </Canvas>

      <TopBar parcelCount={parcels.features.length} />
      <ParcelPillsOverlay positions={pillPositions} />
      {selectedScreenPos && <ParcelCard screenX={selectedScreenPos.x} screenY={selectedScreenPos.y} />}
    </div>
  );
}
