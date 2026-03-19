"use client";

import { useEffect, useRef } from "react";
import { MathUtils } from "three";
import { TilesRenderer } from "3d-tiles-renderer";
import { CesiumIonAuthPlugin, QuantizedMeshPlugin, ReorientationPlugin, UpdateOnChangePlugin } from "3d-tiles-renderer/plugins";
import { useFrame, useThree } from "@react-three/fiber";
import { JOSE_IGNACIO_CENTER } from "@/lib/constants";

const CESIUM_WORLD_TERRAIN = 1;

/**
 * CesiumTerrainLayer — imperative approach
 *
 * Uses the imperative TilesRenderer API instead of R3F declarative components
 * to control initialization order and avoid the QuantizedMeshPlugin crash.
 */
export function CesiumTerrainLayer() {
  const cesiumToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
  const { scene, camera, gl } = useThree();
  const rendererRef = useRef<TilesRenderer | null>(null);
  useEffect(() => {
    if (!cesiumToken) return;

    const tiles = new TilesRenderer();

    // Register QuantizedMeshPlugin FIRST
    tiles.registerPlugin(new QuantizedMeshPlugin({ useRecommendedSettings: true }));

    // Then auth — with empty assetTypeHandler to prevent double-registration
    tiles.registerPlugin(new CesiumIonAuthPlugin({
      apiToken: cesiumToken,
      assetId: CESIUM_WORLD_TERRAIN as any,
      autoRefreshToken: true,
      assetTypeHandler: () => { /* QuantizedMeshPlugin already registered */ },
    }));

    tiles.registerPlugin(new ReorientationPlugin({
      lat: MathUtils.degToRad(JOSE_IGNACIO_CENTER.lat),
      lon: MathUtils.degToRad(JOSE_IGNACIO_CENTER.lon),
      height: 0,
      recenter: true,
    }));

    tiles.registerPlugin(new UpdateOnChangePlugin());

    // Apply ECEF rotation (Z-up to Y-up)
    tiles.group.rotation.set(-Math.PI / 2, 0, 0);

    tiles.setCamera(camera);
    tiles.setResolutionFromRenderer(camera, gl);

    scene.add(tiles.group);
    rendererRef.current = tiles;

    return () => {
      scene.remove(tiles.group);
      tiles.dispose();
      rendererRef.current = null;
    };
  }, [cesiumToken, scene, camera, gl]);

  useFrame(() => {
    if (rendererRef.current) {
      rendererRef.current.update();
    }
  });

  if (!cesiumToken) return null;
  return null;
}
