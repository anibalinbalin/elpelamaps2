"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { EffectComposer, ToneMapping, SMAA } from "@react-three/postprocessing";
import {
  Atmosphere,
  Sky,
  AerialPerspective,
  type AtmosphereApi,
} from "@takram/three-atmosphere/r3f";
import { Ellipsoid, Geodetic, radians } from "@takram/three-geospatial";
import { Dithering } from "@takram/three-geospatial-effects/r3f";
import { JOSE_IGNACIO_CENTER, GOLDEN_HOUR_DATE } from "@/lib/constants";

export function AtmosphereLayer({ children }: { children: React.ReactNode }) {
  const atmosphereRef = useRef<AtmosphereApi>(null);

  useEffect(() => {
    const atm = atmosphereRef.current;
    if (!atm) return;

    const ecef = new Geodetic(
      radians(JOSE_IGNACIO_CENTER.lon),
      radians(JOSE_IGNACIO_CENTER.lat),
      0,
    ).toECEF();

    Ellipsoid.WGS84.getNorthUpEastFrame(ecef, atm.worldToECEFMatrix);
  }, []);

  useFrame(() => {
    atmosphereRef.current?.updateByDate(GOLDEN_HOUR_DATE);
  });

  return (
    <Atmosphere ref={atmosphereRef} correctAltitude>
      <Sky />
      {children}
      <EffectComposer enableNormalPass multisampling={0}>
        <AerialPerspective sunLight skyLight correctGeometricError />
        <ToneMapping />
        <SMAA />
        <Dithering />
      </EffectComposer>
    </Atmosphere>
  );
}
