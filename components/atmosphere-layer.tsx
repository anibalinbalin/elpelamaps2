"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { EffectComposer, ToneMapping, SMAA } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import {
  Atmosphere,
  Sky,
  AerialPerspective,
  type AtmosphereApi,
} from "@takram/three-atmosphere/r3f";
import { Ellipsoid, Geodetic, radians } from "@takram/three-geospatial";
import { Dithering } from "@takram/three-geospatial-effects/r3f";
import { JOSE_IGNACIO_CENTER, PRESENTATION_DATE } from "@/lib/constants";
import { Color, Matrix4, Object3D } from "three";
import {
  DecorativeCloudLayer,
  type CloudMotionPreset,
} from "./decorative-cloud-layer";

interface AtmosphereLayerProps {
  children: React.ReactNode;
  tilesRef?: React.RefObject<{ group?: Object3D | null } | null>;
  cloudMotionPreset?: CloudMotionPreset;
}

export function AtmosphereLayer({
  children,
  tilesRef,
  cloudMotionPreset = "cinematic",
}: AtmosphereLayerProps) {
  const atmosphereRef = useRef<AtmosphereApi>(null);
  const tilesWorldToECEF = useMemo(() => new Matrix4(), []);
  const lastTilesWorldMatrix = useMemo(() => new Matrix4(), []);
  const groundAlbedo = useMemo(() => new Color("#d8bea0"), []);
  const hasSyncedTilesMatrix = useRef(false);

  useEffect(() => {
    const atm = atmosphereRef.current;
    if (!atm) return;

    const ecef = new Geodetic(
      radians(JOSE_IGNACIO_CENTER.lon),
      radians(JOSE_IGNACIO_CENTER.lat),
      0,
    ).toECEF();

    Ellipsoid.WGS84.getNorthUpEastFrame(ecef, atm.worldToECEFMatrix);
    atm.updateByDate(PRESENTATION_DATE);
  }, []);

  useFrame(() => {
    const atm = atmosphereRef.current;
    const tilesGroup = tilesRef?.current?.group;

    if (atm && tilesGroup) {
      tilesGroup.updateWorldMatrix(true, false);
      if (
        (tilesGroup.children.length > 0 || tilesGroup.position.lengthSq() > 0) &&
        (!hasSyncedTilesMatrix.current ||
          !lastTilesWorldMatrix.equals(tilesGroup.matrixWorld))
      ) {
        lastTilesWorldMatrix.copy(tilesGroup.matrixWorld);
        tilesWorldToECEF.copy(tilesGroup.matrixWorld).invert();
        atm.worldToECEFMatrix.copy(tilesWorldToECEF);
        hasSyncedTilesMatrix.current = true;
      }
    }
  });

  return (
    <Atmosphere ref={atmosphereRef} correctAltitude>
      <Sky sunAngularRadius={0.0062} groundAlbedo={groundAlbedo} />
      {children}
      <DecorativeCloudLayer motionPreset={cloudMotionPreset} />
      <EffectComposer enableNormalPass multisampling={0}>
        <AerialPerspective
          sky
          sunLight
          skyLight
          correctGeometricError
          albedoScale={1.1}
        />
        <ToneMapping
          mode={ToneMappingMode.AGX}
          whitePoint={14}
          middleGrey={0.82}
        />
        <SMAA />
        <Dithering />
      </EffectComposer>
    </Atmosphere>
  );
}
