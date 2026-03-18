"use client";

import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { GoogleTilesLayer } from "./google-tiles-layer";
import { ParcelLayer } from "./parcel-layer";
import { GlobeClickHandler } from "./globe-click-handler";
import { INITIAL_CAMERA_POSITION } from "@/lib/constants";

export function MapViewer() {
  const apiToken = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const tilesRef = useRef<any>(null);

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
        camera={{ position: INITIAL_CAMERA_POSITION }}
        flat
        frameloop="demand"
      >
        <color attach="background" args={[0x111111]} />
        <ambientLight intensity={1} />

        <GoogleTilesLayer ref={tilesRef} apiToken={apiToken}>
          <ParcelLayer />
        </GoogleTilesLayer>

        <GlobeClickHandler tilesRef={tilesRef} />
      </Canvas>
    </div>
  );
}
