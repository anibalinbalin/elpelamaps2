"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BrightnessContrast,
  EffectComposer,
  HueSaturation,
  N8AO,
  ToneMapping,
  SMAA,
  Vignette,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import {
  Atmosphere,
  Sky,
  AerialPerspective,
  type AtmosphereApi,
} from "@takram/three-atmosphere/r3f";
import { Ellipsoid, Geodetic, radians } from "@takram/three-geospatial";
import { Dithering } from "@takram/three-geospatial-effects/r3f";
import {
  JOSE_IGNACIO_CENTER,
  VIEWER_LIGHTING_DIRECTIONS,
  type ViewerLightingDirectionId,
} from "@/lib/constants";
import { Color, Matrix4, Object3D } from "three";
import {
  DecorativeCloudLayer,
  type CloudMotionPreset,
} from "./decorative-cloud-layer";

interface AtmosphereLayerProps {
  children: React.ReactNode;
  tilesRef?: React.RefObject<{ group?: Object3D | null } | null>;
  cloudMotionPreset?: CloudMotionPreset;
  cloudSwooshTick?: number;
  cloudsCleared?: boolean;
  lightingDirection?: ViewerLightingDirectionId;
}

export function AtmosphereLayer({
  children,
  tilesRef,
  cloudMotionPreset = "cinematic",
  cloudSwooshTick = 0,
  cloudsCleared = false,
  lightingDirection = "natural-depth",
}: AtmosphereLayerProps) {
  const atmosphereRef = useRef<AtmosphereApi>(null);
  const tilesWorldToECEF = useMemo(() => new Matrix4(), []);
  const lastTilesWorldMatrix = useMemo(() => new Matrix4(), []);
  const lightingPreset = VIEWER_LIGHTING_DIRECTIONS[lightingDirection];
  const groundAlbedo = useMemo(
    () => new Color(lightingPreset.groundAlbedo),
    [lightingPreset.groundAlbedo],
  );
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
  }, []);

  useEffect(() => {
    const atm = atmosphereRef.current;
    if (!atm) return;

    atm.updateByDate(lightingPreset.presentationDate);
  }, [lightingPreset]);

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
      <Sky
        sun={lightingPreset.showSun}
        sunAngularRadius={lightingPreset.sunAngularRadius}
        groundAlbedo={groundAlbedo}
      />
      {children}
      <DecorativeCloudLayer
        motionPreset={cloudMotionPreset}
        swooshTick={cloudSwooshTick}
        cloudsCleared={cloudsCleared}
      />
      <EffectComposer enableNormalPass multisampling={0}>
        <N8AO
          aoRadius={lightingPreset.ambientOcclusion.aoRadius}
          intensity={lightingPreset.ambientOcclusion.intensity}
          distanceFalloff={lightingPreset.ambientOcclusion.distanceFalloff}
          denoiseRadius={lightingPreset.ambientOcclusion.denoiseRadius}
          aoSamples={24}
          denoiseSamples={8}
          screenSpaceRadius
          depthAwareUpsampling
          quality="ultra"
        />
        <AerialPerspective
          sky
          sunLight
          skyLight
          correctGeometricError
          albedoScale={lightingPreset.aerialPerspective.albedoScale}
        />
        <ToneMapping
          mode={ToneMappingMode.AGX}
          whitePoint={lightingPreset.toneMapping.whitePoint}
          middleGrey={lightingPreset.toneMapping.middleGrey}
        />
        <BrightnessContrast
          brightness={lightingPreset.post.brightness}
          contrast={lightingPreset.post.contrast}
        />
        <HueSaturation saturation={lightingPreset.post.saturation} />
        <Vignette
          offset={lightingPreset.post.vignetteOffset}
          darkness={lightingPreset.post.vignetteDarkness}
        />
        <SMAA />
        <Dithering />
      </EffectComposer>
    </Atmosphere>
  );
}
