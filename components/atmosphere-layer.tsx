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

/**
 * Physically-based atmosphere rendering for the 3D viewer.
 *
 * Provides:
 * - Sky with Rayleigh/Mie scattering (replaces canvas gradient SkyDome)
 * - Aerial perspective (distant terrain fades into blue haze)
 * - Post-process sun + sky illumination (replaces directionalLight + ambientLight)
 * - Tone mapping and anti-aliasing
 */
export function AtmosphereLayer({ children }: { children: React.ReactNode }) {
  const atmosphereRef = useRef<AtmosphereApi>(null);

  // Set world-to-ECEF matrix to match ReorientationPlugin's recentered origin
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

  // Update sun position each frame from golden hour date
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
