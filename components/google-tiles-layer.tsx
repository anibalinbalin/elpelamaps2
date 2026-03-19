"use client";

import { forwardRef } from "react";
import { Euler } from "three";
import { TilesRenderer, TilesPlugin, GlobeControls, TilesAttributionOverlay, CompassGizmo } from "3d-tiles-renderer/r3f";
import { GoogleCloudAuthPlugin, CesiumIonAuthPlugin, TilesFadePlugin, UpdateOnChangePlugin, TileCompressionPlugin, ReorientationPlugin } from "3d-tiles-renderer/plugins";
import { MathUtils } from "three";
import { JOSE_IGNACIO_CENTER } from "@/lib/constants";
import { CloudShadowPlugin } from "@/lib/cloud-shadow-plugin";

interface TilesLayerProps {
  apiToken: string;
  children?: React.ReactNode;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ECEF_ROTATION: any = {
  rotation: new Euler(-Math.PI / 2, 0, 0),
};
const CESIUM_GOOGLE_3D_TILES = 2275207;

export const GoogleTilesLayer = forwardRef<any, TilesLayerProps>(
  function GoogleTilesLayer({ apiToken, children }, ref) {
    const cesiumToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;

    const authPlugin = cesiumToken
      ? { plugin: CesiumIonAuthPlugin, args: [{ apiToken: cesiumToken, assetId: CESIUM_GOOGLE_3D_TILES, autoRefreshToken: true }] }
      : { plugin: GoogleCloudAuthPlugin, args: [{ apiToken, autoRefreshToken: true }] };

    return (
      <TilesRenderer ref={ref} group={ECEF_ROTATION}>
        <TilesPlugin plugin={authPlugin.plugin} args={authPlugin.args} />
        <TilesPlugin
          plugin={ReorientationPlugin}
          args={[{
            lat: MathUtils.degToRad(JOSE_IGNACIO_CENTER.lat),
            lon: MathUtils.degToRad(JOSE_IGNACIO_CENTER.lon),
            height: 0,
            recenter: true,
          }]}
        />
        <TilesPlugin plugin={TilesFadePlugin} args={[{ fadeDuration: 300 }]} />
        <TilesPlugin plugin={UpdateOnChangePlugin} />
        <TilesPlugin plugin={TileCompressionPlugin} />
        <TilesPlugin
          plugin={CloudShadowPlugin}
          args={[{ intensity: 0.3, cloudSize: 50000 }]}
        />

        <GlobeControls enableDamping />
        <TilesAttributionOverlay />
        <CompassGizmo />

        {children}
      </TilesRenderer>
    );
  }
);
